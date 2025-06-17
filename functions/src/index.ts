/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";

// Define the OpenAI API key secret
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Initialize Firebase Admin
const app = initializeApp();
const db = getFirestore(app);



// Suggestion analysis function
export const analyzeSuggestions = onCall({
  secrets: [openaiApiKey]
}, async (request) => {
  const startTime = Date.now();
  
  try {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { content, documentId, userId, analysisType = 'full', previouslyModifiedAreas = [] } = request.data;

    if (!content || !documentId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Verify user can only analyze their own documents
    if (request.auth.uid !== userId) {
      throw new HttpsError('permission-denied', 'User can only analyze their own documents');
    }

    // Clear only stale suggestions (where originalText no longer exists in content)
    logger.info('Clearing stale suggestions for document:', documentId);
    const existingSuggestionsQuery = db.collection('suggestions')
      .where('documentId', '==', documentId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending'); // Only check pending suggestions
    const existingSuggestions = await existingSuggestionsQuery.get();
    
    if (!existingSuggestions.empty) {
      const deleteBatch = db.batch();
      let staleCount = 0;
      let validCount = 0;
      
      existingSuggestions.docs.forEach(doc => {
        const suggestion = doc.data();
        // Check if the original text still exists in the content
        if (!content.includes(suggestion.originalText)) {
          deleteBatch.delete(doc.ref);
          staleCount++;
          logger.info(`Marking stale suggestion for deletion: "${suggestion.originalText}"`);
        } else {
          validCount++;
          logger.info(`Keeping valid suggestion: "${suggestion.originalText}"`);
        }
      });
      
      if (staleCount > 0) {
        await deleteBatch.commit();
        logger.info(`Deleted ${staleCount} stale suggestions, kept ${validCount} valid suggestions`);
      } else {
        logger.info(`No stale suggestions to delete, ${validCount} suggestions remain valid`);
      }
    }

    // Rate limiting - Max 10 requests per minute per user
    logger.info('Attempting to access Firestore for rate limiting...');
    const rateLimitRef = db.collection('rateLimits').doc(userId);
    const rateLimitDoc = await rateLimitRef.get();
    logger.info('Successfully accessed rateLimitRef, document exists:', rateLimitDoc.exists);

    if (rateLimitDoc.exists) {
      const rateLimitData = rateLimitDoc.data();
      logger.info('Rate limit data found:', {
        requestCount: rateLimitData?.requests?.length || 0,
      });
      const now = Date.now();
      const windowStart = now - (60 * 1000); // 1-minute window
      
      if (rateLimitData?.requests && rateLimitData.requests.length >= 10) {
        const recentRequests = rateLimitData.requests.filter((timestamp: number) => timestamp > windowStart);
        if (recentRequests.length >= 10) {
          logger.warn('Rate limit exceeded for user:', userId);
          throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Max 10 requests per minute.');
        }
      }
    }

    // Update rate limit counter
    logger.info('Attempting to update rate limit counter...');
    const currentRequests = rateLimitDoc.exists ? 
      (rateLimitDoc.data()?.requests || []).filter((timestamp: number) => timestamp > (Date.now() - 60000)) : [];
    currentRequests.push(Date.now());
    
    await rateLimitRef.set({
      requests: currentRequests,
      lastRequest: new Date(),
    }, { merge: true });
    logger.info('Successfully updated rate limit counter.');

    logger.info(`Analyzing suggestions for document ${documentId}`, { 
      userId, 
      contentLength: content.length,
      analysisType 
    });

    // Check if OpenAI is configured
    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      logger.warn('OpenAI API key not configured, returning mock suggestions');
      return await generateMockSuggestions(content, documentId, userId, startTime);
    }

    // Initialize OpenAI with the API key
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Call OpenAI GPT-4o API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: `You are an expert writing assistant. Analyze the provided text and return suggestions for improvements in the following categories:
          
          1. SPELLING: Identify and correct spelling errors (like "teh" → "the", "lets" → "let's")
          2. CLARITY: Suggest improvements for unclear or confusing sentences
          3. ENGAGEMENT: Recommend ways to make the text more engaging and compelling
          4. GRAMMAR: Fix grammatical errors including:
             - Missing capitalization at sentence start (e.g., "hello world" → "Hello world")
             - Missing punctuation at sentence end (e.g., "Hello world" → "Hello world.")
             - Contractions (e.g., "lets go" → "let's go")
             - Subject-verb agreement and other grammatical issues
          
          IMPORTANT GUIDELINES:
          - For missing capitalization: suggest ONLY capitalizing the first letter, don't change the rest
          - For missing punctuation: CAREFULLY CHECK if punctuation already exists - suggest ONLY adding a period if there's truly no punctuation at the end
          - BEFORE suggesting punctuation: verify the sentence doesn't already end with a period, question mark, or exclamation point
          - Don't suggest fancy formatting like "Hello, World!" unless specifically appropriate
          - Prefer simple, minimal changes that fix specific issues
          - Each suggestion should address ONE specific issue
          - CRITICAL: Do not suggest adding periods if one already exists - check the exact end of the sentence carefully
          
          ANTI-ENDLESS SUGGESTION RULES:
          - CRITICAL: Some areas have been previously modified for clarity/engagement improvements
          - DO NOT suggest clarity improvements for text areas that have already been modified 1+ times (ONLY ONE CLARITY CHANGE PER AREA EVER)
          - DO NOT suggest engagement improvements for text areas that have already been modified 1+ times (ONLY ONE ENGAGEMENT CHANGE PER AREA EVER)
          - CLARITY suggestions should be COMPREHENSIVE - if an area needs clarity improvement, suggest a substantial rewrite rather than minor tweaks
          - ENGAGEMENT suggestions should be EXTREMELY RARE and only for obviously poor engagement
          - CRITICAL: ENGAGEMENT suggestions are creating endless loops - be ULTRA-CONSERVATIVE
          - DO NOT suggest engagement improvements unless the text is truly awful and unprofessional
          - AVOID any engagement suggestions that might be subjective or stylistic preferences
          - NEVER suggest reversing a previous change or going back to an earlier version
          - AVOID suggesting changes that would create a back-and-forth pattern
          - Be ULTRA-CONSERVATIVE with both clarity and engagement suggestions - they create endless loops
          - Focus on spelling and grammar errors which are objective, avoid subjective clarity/engagement changes in heavily modified areas
          - If an area has been modified recently, DO NOT suggest any further clarity/engagement changes (3-minute cooldown)
          - When in doubt about whether to suggest a clarity/engagement change, DON'T suggest it
          - Clarity/engagement changes should be substantial, comprehensive improvements, not minor tweaks
          - If you suggest a clarity improvement, make it count - rewrite the entire problematic section properly
          
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
          content: `Please analyze this text and provide suggestions: "${content}"
          
          ${previouslyModifiedAreas.length > 0 ? `
          PREVIOUSLY MODIFIED AREAS (do not suggest further changes for areas modified 3+ times):
          ${previouslyModifiedAreas.map((area: any) => 
            `- Text: "${area.modifiedText}" (type: ${area.type}, iterations: ${area.iterationCount}, position: ${area.startIndex}-${area.endIndex})`
          ).join('\n')}` : 'No previously modified areas.'}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    // Log the entire completion object for detailed debugging
    logger.info("OpenAI raw response text:", responseText);

    if (!responseText) {
      throw new HttpsError('internal', 'No response from OpenAI');
    }

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Invalid response format from OpenAI:', responseText);
      throw new HttpsError('internal', 'Invalid response format from OpenAI');
    }

    // Get current valid suggestions to avoid duplicates
    const currentSuggestionsQuery = db.collection('suggestions')
      .where('documentId', '==', documentId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending');
    const currentSuggestionsSnapshot = await currentSuggestionsQuery.get();
    const existingOriginalTexts = new Set(
      currentSuggestionsSnapshot.docs.map(doc => doc.data().originalText)
    );
    
    // Process and save suggestions to Firestore using batch operations
    logger.info('Attempting to create Firestore batch for saving suggestions...');
    const batch = db.batch();
    const savedSuggestions = [];
    const analysisId = `analysis_${Date.now()}`;
    let engagementSuggestionCount = 0;
    let claritySuggestionCount = 0;
    const maxEngagementSuggestions = 1; // Limit engagement suggestions per analysis (ULTRA-STRICT)
    const maxClaritySuggestions = 3; // Limit clarity suggestions per analysis
    logger.info('Firestore batch created. Processing suggestions...');

    for (const suggestion of analysisResult.suggestions || []) {
      // Skip if we already have a suggestion for this text
      if (existingOriginalTexts.has(suggestion.originalText)) {
        logger.info(`Skipping duplicate suggestion for: "${suggestion.originalText}"`);
        continue;
      }
      
      // Find the start and end indices of the original text
      const startIndex = content.indexOf(suggestion.originalText);
      if (startIndex === -1) {
        logger.warn('Could not find originalText for suggestion, skipping:', { suggestion });
        continue; // Skip if text not found
      }

      const endIndex = startIndex + suggestion.originalText.length;

      // PUNCTUATION VALIDATION: Prevent suggesting periods when they already exist
      if (suggestion.type === 'grammar' && suggestion.explanation && 
          suggestion.explanation.toLowerCase().includes('punctuation')) {
        // Check if the suggestion is about adding punctuation
        const originalEndsWithPunctuation = /[.!?]$/.test(suggestion.originalText.trim());
        const suggestedEndsWithPunctuation = /[.!?]$/.test(suggestion.suggestedText.trim());
        
        // If original already has punctuation but we're suggesting to add more, skip it
        if (originalEndsWithPunctuation && suggestedEndsWithPunctuation && 
            suggestion.suggestedText.trim().endsWith('.') && suggestion.originalText.trim().endsWith('.')) {
          logger.info(`[PunctuationValidation] EXCLUDING grammar suggestion - period already exists: "${suggestion.originalText}" -> "${suggestion.suggestedText}"`);
          continue;
        }
        
        // Also check the broader context around the suggestion to catch periods that might be just outside
        const contextStart = Math.max(0, startIndex - 2);
        const contextEnd = Math.min(content.length, endIndex + 2);
        const contextText = content.slice(contextStart, contextEnd);
        
        if (suggestion.suggestedText.includes('.') && contextText.includes('..')) {
          logger.info(`[PunctuationValidation] EXCLUDING grammar suggestion - would create double periods: context="${contextText}" suggestion="${suggestion.suggestedText}"`);
          continue;
        }
      }

      // EMERGENCY BRAKE: If there are ANY engagement modifications in the past hour, block ALL engagement suggestions
      if (suggestion.type === 'engagement' && previouslyModifiedAreas.length > 0) {
        const hasRecentEngagementMods = previouslyModifiedAreas.some((area: any) => {
          if (area.type === 'engagement') {
            const lastModified = area.lastModified?.toDate ? area.lastModified.toDate() : new Date(area.lastModified);
            const withinLastHour = (Date.now() - lastModified.getTime()) < 3600000; // 1 hour
            return withinLastHour;
          }
          return false;
        });
        
        if (hasRecentEngagementMods) {
          logger.info(`[AntiEndless] EMERGENCY BRAKE: Blocking ALL engagement suggestions due to recent engagement modifications in past hour`);
          continue;
        }
      }

      // Skip clarity and engagement suggestions for areas that have been modified too many times
      if ((suggestion.type === 'clarity' || suggestion.type === 'engagement') && previouslyModifiedAreas.length > 0) {
        logger.info(`[AntiEndless] Checking ${suggestion.type} suggestion: "${suggestion.originalText}" at ${startIndex}-${endIndex}`);
        logger.info(`[AntiEndless] Found ${previouslyModifiedAreas.length} previously modified areas`);
        
        const shouldExclude = previouslyModifiedAreas.some((area: any) => {
          // Check if this suggestion overlaps with a previously modified area
          const overlaps = !(endIndex <= area.startIndex || area.endIndex <= startIndex);
          const sameType = area.type === suggestion.type;
          
          // ENGAGEMENT and CLARITY suggestions are only allowed ONCE per area
          const maxIterations = (suggestion.type === 'engagement' || suggestion.type === 'clarity') ? 1 : 2;
          const overLimit = (area.iterationCount || 1) >= maxIterations;
          
          // Check if area was modified very recently - ENGAGEMENT and CLARITY have longer cooldowns
          const lastModified = area.lastModified?.toDate ? area.lastModified.toDate() : new Date(area.lastModified);
          const cooldownPeriod = (suggestion.type === 'engagement' || suggestion.type === 'clarity') ? 180000 : 30000; // 3 minutes for engagement/clarity, 30 seconds for grammar
          const recentlyModified = (Date.now() - lastModified.getTime()) < cooldownPeriod;
          
          // For engagement, also check for text similarity to catch near-duplicates
          let textSimilarity = false;
          if (suggestion.type === 'engagement') {
            const cleanOriginal = suggestion.originalText.toLowerCase().replace(/[^\w\s]/g, '').trim();
            const cleanModified = (area.originalText || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
            const cleanModifiedText = (area.modifiedText || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
            
            // Check if the suggestion text is very similar to previously modified text
            textSimilarity = cleanOriginal === cleanModified || cleanOriginal === cleanModifiedText ||
                           cleanOriginal.includes(cleanModified) || cleanModified.includes(cleanOriginal) ||
                           cleanOriginal.includes(cleanModifiedText) || cleanModifiedText.includes(cleanOriginal);
          }
          
          logger.info(`[AntiEndless] Checking area ${area.startIndex}-${area.endIndex} (${area.type}, iterations: ${area.iterationCount}): overlaps=${overlaps}, sameType=${sameType}, overLimit=${overLimit} (max: ${maxIterations}), recentlyModified=${recentlyModified} (cooldown: ${cooldownPeriod/1000}s), textSimilarity=${textSimilarity}`);
          
          return overlaps && sameType && (overLimit || recentlyModified || textSimilarity);
        });
        
        if (shouldExclude) {
          logger.info(`[AntiEndless] EXCLUDING ${suggestion.type} suggestion for over-modified area: "${suggestion.originalText}"`);
          continue;
        } else {
          logger.info(`[AntiEndless] ALLOWING ${suggestion.type} suggestion: "${suggestion.originalText}"`);
        }
      }

      // Require higher confidence for clarity and engagement suggestions
      const minConfidence = suggestion.type === 'engagement' ? 0.85 : 0.80; // Moderate confidence for engagement
      if ((suggestion.type === 'engagement' || suggestion.type === 'clarity') && suggestion.confidence < minConfidence) {
        logger.info(`[AntiEndless] EXCLUDING ${suggestion.type} suggestion due to low confidence: "${suggestion.originalText}" (confidence: ${suggestion.confidence}, required: ${minConfidence})`);
        continue;
      }

      // Limit the number of engagement and clarity suggestions per analysis
      if (suggestion.type === 'engagement') {
        if (engagementSuggestionCount >= maxEngagementSuggestions) {
          logger.info(`[AntiEndless] EXCLUDING engagement suggestion due to limit reached: "${suggestion.originalText}" (${engagementSuggestionCount}/${maxEngagementSuggestions})`);
          continue;
        }
        
        // Additional check for engagement: prevent suggestions that are too similar to existing content
        const cleanSuggested = suggestion.suggestedText.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const cleanOriginal = suggestion.originalText.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        // Check if the suggested text is too similar to the original (no real improvement)
        const similarity = cleanSuggested.length > 0 && cleanOriginal.length > 0 ? 
          (cleanSuggested === cleanOriginal ? 1 : 
           (cleanSuggested.includes(cleanOriginal) || cleanOriginal.includes(cleanSuggested) ? 0.8 : 0)) : 0;
        
        if (similarity > 0.7) {
          logger.info(`[AntiEndless] EXCLUDING engagement suggestion - too similar to original: "${suggestion.originalText}" -> "${suggestion.suggestedText}" (similarity: ${similarity})`);
          continue;
        }
        
        engagementSuggestionCount++;
      } else if (suggestion.type === 'clarity') {
        if (claritySuggestionCount >= maxClaritySuggestions) {
          logger.info(`[AntiEndless] EXCLUDING clarity suggestion due to limit reached: "${suggestion.originalText}" (${claritySuggestionCount}/${maxClaritySuggestions})`);
          continue;
        }
        claritySuggestionCount++;
      }

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
        endIndex: endIndex,
        confidence: suggestion.confidence,
        status: 'pending',
        analysisId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const suggestionRef = db.collection('suggestions').doc();
      batch.set(suggestionRef, suggestionData);
      savedSuggestions.push({
        id: suggestionRef.id,
        ...suggestionData,
      });
      
      // Add to existing set to prevent duplicates within this batch
      existingOriginalTexts.add(suggestion.originalText);
    }

    logger.info(`Processed ${savedSuggestions.length} suggestions. Committing batch...`);
    await batch.commit();
    logger.info('Successfully committed Firestore batch.');

    const processingTime = Date.now() - startTime;

    logger.info(`Analysis completed for document ${documentId}`, {
      suggestionCount: savedSuggestions.length,
      processingTime,
      analysisId,
    });

    return {
      suggestions: savedSuggestions,
      analysisId,
      processingTime,
      tokenUsage: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };

  } catch (error) {
    logger.error('Error in analyzeSuggestions:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to analyze suggestions');
  }
});

// Mock suggestions generator when OpenAI is not configured
async function generateMockSuggestions(content: string, documentId: string, userId: string, startTime: number) {
  const mockSuggestions = [];
  const analysisId = `mock_analysis_${Date.now()}`;

  // Check for common spelling errors
  const spellingErrors = [
    { wrong: 'teh', correct: 'the' },
    { wrong: 'recieve', correct: 'receive' },
    { wrong: 'definately', correct: 'definitely' },
    { wrong: 'seperate', correct: 'separate' },
    { wrong: 'occured', correct: 'occurred' },
    { wrong: 'accomodate', correct: 'accommodate' },
    { wrong: 'neccessary', correct: 'necessary' },
  ];

  const batch = db.batch();

  // Check for spelling errors
  spellingErrors.forEach(error => {
    logger.info(`Checking for spelling error: ${error.wrong}`);
    const regex = new RegExp(`\\b${error.wrong}\\b`, 'gi');
    let match;
    while ((match = regex.exec(content)) !== null) {
      logger.info(`Found spelling error "${error.wrong}" at index ${match.index}`);
      const suggestionData = {
        documentId,
        userId,
        type: 'spelling',
        category: 'error',
        severity: 'high',
        originalText: match[0],
        suggestedText: error.correct,
        explanation: `Spelling error: '${match[0]}' should be '${error.correct}'`,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95,
        status: 'pending',
        analysisId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const suggestionRef = db.collection('suggestions').doc();
      batch.set(suggestionRef, suggestionData);
      mockSuggestions.push({
        id: suggestionRef.id,
        ...suggestionData,
      });
    }
  });

  // Check for repetitive words
  const repetitivePattern = /\b(\w+)\s+\1\b/gi;
  let match;
  while ((match = repetitivePattern.exec(content)) !== null) {
    const suggestionData = {
      documentId,
      userId,
      type: 'clarity',
      category: 'improvement',
      severity: 'medium',
      originalText: match[0],
      suggestedText: match[1],
      explanation: `Remove repetitive word: '${match[0]}' can be simplified to '${match[1]}'`,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      confidence: 0.8,
      status: 'pending',
      analysisId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const suggestionRef = db.collection('suggestions').doc();
    batch.set(suggestionRef, suggestionData);
    mockSuggestions.push({
      id: suggestionRef.id,
      ...suggestionData,
    });
  }

  // Check for common grammar patterns that fix multiple issues
  // Process these FIRST to ensure they get priority over OpenAI suggestions
  const grammarPatterns = [
    {
      pattern: /^lets go to teh (\w+)$/gi,
      replacement: "Let's go to the $1.",
      explanation: "Fixed grammar: Capitalized sentence, use 'Let's' (contraction), corrected spelling of 'the', and added punctuation",
      priority: 1 // Highest priority
    },
    {
      pattern: /^([a-z][^.!?]*[a-zA-Z])$/,
      replacement: "", // Will be handled in the replacement logic
      explanation: "Fixed grammar: Capitalized sentence start and added proper punctuation",
      priority: 2
    }
  ];

  // Process grammar patterns BEFORE other suggestions
  grammarPatterns.forEach(grammarPattern => {
    let match: RegExpExecArray | null;
    while ((match = grammarPattern.pattern.exec(content)) !== null) {
      let suggestedText: string;
      
      // Handle different types of grammar fixes
      if (grammarPattern.explanation.includes('Capitalized sentence start and added proper punctuation')) {
        // Capitalize first letter and add punctuation
        const originalText = match[0];
        suggestedText = originalText.charAt(0).toUpperCase() + originalText.slice(1) + '.';
      } else {
        // Use standard replacement with variable substitution
        suggestedText = grammarPattern.replacement.replace(/\$(\d+)/g, (_, num) => match![parseInt(num)] || '');
      }

      const suggestionData = {
        documentId,
        userId,
        type: 'grammar',
        category: 'error',
        severity: 'high',
        originalText: match[0],
        suggestedText,
        explanation: grammarPattern.explanation,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95, // Higher confidence than OpenAI suggestions
        status: 'pending',
        analysisId,
        priority: grammarPattern.priority,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const suggestionRef = db.collection('suggestions').doc();
      batch.set(suggestionRef, suggestionData);
      mockSuggestions.push({
        id: suggestionRef.id,
        ...suggestionData,
      });
    }
  });

  // Check for weak phrases
  const weakPhrases = [
    { weak: 'very good', strong: 'excellent', type: 'engagement' },
    { weak: 'pretty nice', strong: 'appealing', type: 'engagement' },
    { weak: 'kind of', strong: 'somewhat', type: 'clarity' },
    { weak: 'a lot of', strong: 'many', type: 'clarity' },
    { weak: 'really cool', strong: 'impressive', type: 'engagement' },
  ];

  weakPhrases.forEach(phrase => {
    const index = content.toLowerCase().indexOf(phrase.weak.toLowerCase());
    if (index !== -1) {
      const suggestionData = {
        documentId,
        userId,
        type: phrase.type,
        category: 'enhancement',
        severity: 'low',
        originalText: content.substr(index, phrase.weak.length),
        suggestedText: phrase.strong,
        explanation: `Consider using '${phrase.strong}' instead of '${phrase.weak}' for more impact`,
        startIndex: index,
        endIndex: index + phrase.weak.length,
        confidence: 0.7,
        status: 'pending',
        analysisId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const suggestionRef = db.collection('suggestions').doc();
      batch.set(suggestionRef, suggestionData);
      mockSuggestions.push({
        id: suggestionRef.id,
        ...suggestionData,
      });
    }
  });

  logger.info(`Generated ${mockSuggestions.length} initial suggestions`);
  
  // Sort suggestions by position and remove overlapping ones
  mockSuggestions.sort((a, b) => a.startIndex - b.startIndex);
  
  // Remove overlapping suggestions (keep the first one encountered)
  const filteredSuggestions = [];
  let lastEndIndex = -1;
  
  for (const suggestion of mockSuggestions) {
    if (suggestion.startIndex >= lastEndIndex) {
      filteredSuggestions.push(suggestion);
      lastEndIndex = suggestion.endIndex;
      logger.info(`Keeping suggestion: "${suggestion.originalText}" at ${suggestion.startIndex}-${suggestion.endIndex}`);
    } else {
      logger.info('Removing overlapping suggestion:', {
        overlapping: suggestion.originalText,
        startIndex: suggestion.startIndex,
        endIndex: suggestion.endIndex,
        conflictsWith: `lastEndIndex: ${lastEndIndex}`
      });
    }
  }
  
  logger.info(`After filtering: ${filteredSuggestions.length} suggestions remain`);

  // Clear the batch and re-add only the filtered suggestions
  const filteredBatch = db.batch();
  const finalSuggestions = [];
  
  for (const suggestion of filteredSuggestions) {
    const suggestionRef = db.collection('suggestions').doc();
    // Create a copy without the id field
    const { id, ...suggestionData } = suggestion;
    
    filteredBatch.set(suggestionRef, suggestionData);
    finalSuggestions.push({
      id: suggestionRef.id,
      ...suggestionData,
    });
  }

  await filteredBatch.commit();

  const processingTime = Date.now() - startTime;

  logger.info(`Mock analysis completed for document ${documentId}`, {
    suggestionCount: finalSuggestions.length,
    originalCount: mockSuggestions.length,
    filteredCount: mockSuggestions.length - finalSuggestions.length,
    processingTime,
    analysisId,
  });

  return {
    suggestions: finalSuggestions,
    analysisId,
    processingTime,
    tokenUsage: {
      prompt: 0,
      completion: 0,
      total: 0,
    },
  };
}

// Health check function
export const healthCheck = onCall({
  secrets: [openaiApiKey]
}, async (request) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    openaiConfigured: !!openaiApiKey.value(),
    authenticated: !!request.auth,
  };
});

// Function to get suggestion statistics
export const getSuggestionStats = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const { documentId } = request.data || {};

    let query = db.collection('suggestions').where('userId', '==', userId);
    
    if (documentId) {
      query = query.where('documentId', '==', documentId);
    }

    const snapshot = await query.get();
    const suggestions = snapshot.docs.map(doc => doc.data());

    const stats = {
      total: suggestions.length,
      pending: suggestions.filter(s => s.status === 'pending').length,
      accepted: suggestions.filter(s => s.status === 'accepted').length,
      rejected: suggestions.filter(s => s.status === 'rejected').length,
      byType: {
        spelling: suggestions.filter(s => s.type === 'spelling').length,
        grammar: suggestions.filter(s => s.type === 'grammar').length,
        clarity: suggestions.filter(s => s.type === 'clarity').length,
        engagement: suggestions.filter(s => s.type === 'engagement').length,
      },
      averageConfidence: suggestions.reduce((sum, s) => sum + (s.confidence || 0), 0) / suggestions.length || 0,
    };

    return stats;

  } catch (error) {
    logger.error('Error getting suggestion stats:', error);
    throw new HttpsError('internal', 'Failed to get suggestion statistics');
  }
});

// Function to clean up old rate limit data (runs daily)
export const cleanupRateLimits = onSchedule('every 24 hours', async (event) => {
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  
  const rateLimitsRef = db.collection('rateLimits');
  const snapshot = await rateLimitsRef.get();
  
  const batch = db.batch();
  let deleteCount = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.lastRequest && data.lastRequest.toMillis() < cutoffTime) {
      batch.delete(doc.ref);
      deleteCount++;
    }
  });
  
  await batch.commit();
  
  logger.info(`Cleaned up ${deleteCount} old rate limit records`);
});
