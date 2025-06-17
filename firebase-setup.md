# Firebase Cloud Functions Setup for Epic 3: AI Suggestions

## Overview
This document provides step-by-step instructions for setting up Firebase Cloud Functions to integrate with OpenAI's GPT-4o API for AI-powered writing suggestions.

## Prerequisites
1. Firebase project set up (already done)
2. Firebase CLI installed globally: `npm install -g firebase-tools`
3. OpenAI API key from https://platform.openai.com/account/api-keys

## Step 1: Firebase Authentication & Project Setup

```bash
# Login to Firebase
firebase login

# Initialize Firebase Functions in your project
firebase init functions
```

Select:
- Use an existing project: `wordwise-ai-3a4e1`
- Language: TypeScript
- Use ESLint: Yes
- Install dependencies: Yes

## Step 2: Environment Configuration

Create `functions/.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

Add to `functions/src/index.ts`:
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { OpenAI } from 'openai';

admin.initializeApp();

const openai = new OpenAI({
  apiKey: functions.config().openai.api_key,
});

// Suggestion analysis function
export const analyzeSuggestions = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { content, documentId, userId, analysisType = 'full' } = data;

    if (!content || !documentId || !userId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Call OpenAI GPT-4o API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert writing assistant. Analyze the provided text and return suggestions for improvements in the following categories:
          
          1. SPELLING: Identify and correct spelling errors
          2. CLARITY: Suggest improvements for unclear or confusing sentences
          3. ENGAGEMENT: Recommend ways to make the text more engaging and compelling
          4. GRAMMAR: Fix grammatical errors and awkward phrasing
          
          For each suggestion, provide:
          - type: "spelling" | "clarity" | "engagement" | "grammar"
          - category: "error" | "improvement" | "enhancement"
          - severity: "low" | "medium" | "high"
          - originalText: the exact text to be replaced
          - suggestedText: the improved version
          - explanation: why this change is recommended
          - confidence: a number between 0 and 1 indicating confidence in the suggestion
          
          Return the response as a JSON object with a "suggestions" array.`
        },
        {
          role: 'user',
          content: `Please analyze this text and provide suggestions: "${content}"`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new functions.https.HttpsError('internal', 'No response from OpenAI');
    }

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      throw new functions.https.HttpsError('internal', 'Invalid response format from OpenAI');
    }

    // Process and save suggestions to Firestore
    const db = admin.firestore();
    const batch = db.batch();
    const savedSuggestions = [];

    for (const suggestion of analysisResult.suggestions) {
      // Find the start and end indices of the original text
      const startIndex = content.indexOf(suggestion.originalText);
      if (startIndex === -1) continue; // Skip if text not found

      const suggestionData = {
        documentId,
        userId,
        type: suggestion.type,
        category: suggestion.category,
        severity: suggestion.severity,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        explanation: suggestion.explanation,
        startIndex,
        endIndex: startIndex + suggestion.originalText.length,
        confidence: suggestion.confidence,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const suggestionRef = db.collection('suggestions').doc();
      batch.set(suggestionRef, suggestionData);
      savedSuggestions.push({
        id: suggestionRef.id,
        ...suggestionData,
      });
    }

    await batch.commit();

    return {
      suggestions: savedSuggestions,
      analysisId: `analysis_${Date.now()}`,
      processingTime: Date.now() - context.timestamp,
      tokenUsage: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };

  } catch (error) {
    console.error('Error in analyzeSuggestions:', error);
    throw new functions.https.HttpsError('internal', 'Failed to analyze suggestions');
  }
});
```

## Step 3: Install Dependencies

```bash
cd functions
npm install openai firebase-admin firebase-functions
```

## Step 4: Configure Environment Variables

```bash
# Set OpenAI API key
firebase functions:config:set openai.api_key="your_openai_api_key_here"
```

## Step 5: Deploy Functions

```bash
# Deploy to Firebase
firebase deploy --only functions
```

## Step 6: Firestore Security Rules

Update `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own documents
    match /documents/{documentId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Users can read/write suggestions for their documents
    match /suggestions/{suggestionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Step 7: Testing the Function

You can test the function locally:
```bash
cd functions
npm run serve
```

## API Usage Example

```typescript
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';

const functions = getFunctions();
const analyzeSuggestions = httpsCallable(functions, 'analyzeSuggestions');

const result = await analyzeSuggestions({
  documentId: 'doc123',
  content: 'Your text to analyze',
  userId: 'user123',
  analysisType: 'full'
});

console.log('Suggestions:', result.data.suggestions);
```

## Cost Considerations

- GPT-4o pricing: ~$0.03 per 1K tokens
- Typical document analysis: 500-2000 tokens
- Cost per analysis: $0.015 - $0.06
- Consider implementing rate limiting and caching for production

## Rate Limiting (Recommended)

Add rate limiting to prevent API abuse:
```typescript
// Add to the beginning of the function
const rateLimitRef = db.collection('rateLimits').doc(userId);
const rateLimitDoc = await rateLimitRef.get();

if (rateLimitDoc.exists) {
  const data = rateLimitDoc.data();
  const now = Date.now();
  const windowStart = now - (60 * 1000); // 1-minute window
  
  if (data.requests && data.requests.length >= 10) { // Max 10 requests per minute
    const recentRequests = data.requests.filter(timestamp => timestamp > windowStart);
    if (recentRequests.length >= 10) {
      throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded');
    }
  }
}
```

## Monitoring & Analytics

Set up monitoring in Firebase Console:
1. Go to Functions tab
2. Monitor invocations, errors, and duration
3. Set up alerts for errors or high usage

## Next Steps for Production

1. **Caching**: Implement Redis/Firestore caching for repeated content
2. **Batch Processing**: Process multiple documents in a single API call
3. **Incremental Analysis**: Only analyze changed portions of documents
4. **Custom Models**: Fine-tune GPT-4o for domain-specific writing improvements
5. **Multilingual Support**: Add language detection and localized suggestions

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Ensure proper Firebase configuration
2. **Authentication Errors**: Verify user is logged in before calling
3. **Rate Limits**: Implement proper rate limiting
4. **Token Limits**: Handle long documents by chunking content

### Debug Commands:
```bash
# View function logs
firebase functions:log

# Test locally
firebase emulators:start --only functions,firestore
```

This setup provides a robust foundation for Epic 3's AI suggestion system with real GPT-4o integration! 