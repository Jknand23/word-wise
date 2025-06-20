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

// Generate system prompt based on writing goals
function generateSystemPrompt(writingGoals?: any): string {
  const academicLevel = writingGoals?.academicLevel || 'high-school';
  const assignmentType = writingGoals?.assignmentType || 'essay';
  const grammarStrictness = writingGoals?.grammarStrictness || 'moderate';
  const vocabularyLevel = writingGoals?.vocabularyLevel || 'intermediate';
  const toneRecommendation = writingGoals?.toneRecommendation || 'Formal and well-structured';
  const customInstructions = writingGoals?.customInstructions || '';

  let analysisDepth = '';
  let additionalCategories = '';
  
  // Adjust analysis depth based on academic level
  switch (academicLevel) {
    case 'middle-school':
      analysisDepth = `
      ANALYSIS FOCUS for MIDDLE SCHOOL level:
      - Focus on fundamental writing skills and basic sentence construction
      - Provide simple, encouraging explanations that build confidence
      - Encourage complete sentences and basic paragraph structure
      - Grammar suggestions should be straightforward and educational (capitals, periods, basic punctuation)
      - Focus on making sure each sentence expresses a complete thought
      - Help with basic organization: beginning, middle, end
      - Encourage descriptive words and varied sentence beginnings
      - Keep suggestions positive and constructive to build writing confidence`;
      additionalCategories = 'Basic tone and simple structure suggestions may be provided to encourage clear communication.';
      break;
      
    case 'high-school':
      analysisDepth = `
      ANALYSIS FOCUS for HIGH SCHOOL level:
      - Encourage clearer paragraph structure and better topic sentences
      - Focus on developing complete thoughts and logical connections between ideas
      - Build vocabulary beyond basic words but not yet advanced academic terminology
      - Grammar suggestions should include compound/complex sentence construction
      - Flag obvious run-on sentences but be more lenient than undergraduate level
      - Suggest basic transitions (First, Next, However, Therefore) to improve flow
      - Encourage more precise word choices without demanding sophisticated terminology
      - Help develop argument structure with clear introduction, body, and conclusion`;
      additionalCategories = `
      5. TONE: Suggest improvements to match ${assignmentType} writing expectations (formal but accessible)
      6. STRUCTURE: Recommend improvements to paragraph organization and basic transitions between ideas
      High school level: Building toward academic writing with clear expectations but reasonable standards.`;
      break;
      
    case 'undergrad':
      analysisDepth = `
      ANALYSIS FOCUS for UNDERGRADUATE level:
      - Demand rigorous analysis and sophisticated argumentation
      - Focus on complex sentence structures and advanced vocabulary
      - Provide detailed explanations of rhetorical effectiveness
      - Grammar suggestions should include nuanced style points
      - Expect higher standards for evidence integration and critical thinking
      - AGGRESSIVELY identify run-on sentences and suggest splitting them
      - Flag informal language and suggest more academic alternatives
      - Require proper punctuation for dialogue and quotes
      - Demand sophisticated transitions between sentences and ideas
      - Challenge basic word choices and suggest more precise terminology`;
      additionalCategories = `
      5. TONE: Ensure academic tone appropriate for ${assignmentType} assignments (flag informal phrases like "really changed", "very much")
      6. STRUCTURE: Analyze argument flow, transitions, and organizational logic (flag abrupt sentence starts, missing connectives)
      7. DEPTH: Suggest deeper analysis, more sophisticated reasoning, and stronger evidence (challenge surface-level observations)
      8. VOCABULARY: Recommend more precise, academic, or field-specific terminology (replace casual words with sophisticated alternatives)
      Comprehensive analysis for undergraduate academic writing with high standards.`;
      break;
  }

  // Assignment-specific guidance
  let assignmentGuidance = '';
  switch (assignmentType) {
    case 'essay':
      assignmentGuidance = `
      ESSAY-SPECIFIC GUIDANCE:
      - Focus on thesis clarity and argument development
      - Ensure proper evidence integration and citation style
      - Check for logical flow between paragraphs
      - Maintain formal academic tone throughout`;
      break;
    case 'reflection':
      assignmentGuidance = `
      REFLECTION-SPECIFIC GUIDANCE:
      - Allow for first-person perspective and personal insights
      - Focus on thoughtful analysis of experiences
      - Ensure balance between personal narrative and analytical reflection
      - Support personal insights with specific examples`;
      break;
    case 'report':
      assignmentGuidance = `
      REPORT-SPECIFIC GUIDANCE:
      - Prioritize objective, factual presentation
      - Focus on clear organization and data presentation
      - Ensure proper use of headings and sections
      - Maintain neutral, professional tone throughout`;
      break;
  }

  return `You are an expert writing assistant. Analyze the provided text and return suggestions for improvements in the following categories:

CORE CATEGORIES (ALWAYS ANALYZED):
1. SPELLING: Identify and correct spelling errors (like "teh" → "the", "lets" → "let's")
2. GRAMMAR: Fix grammatical errors with ${grammarStrictness} strictness including:
   - Missing capitalization at sentence start (e.g., "hello world" → "Hello world")
   - Missing punctuation at sentence end (e.g., "Hello world" → "Hello world.")
   - Contractions (e.g., "lets go" → "let's go")
   - Subject-verb agreement and other grammatical issues
3. CLARITY: Suggest improvements for unclear or confusing sentences
4. ENGAGEMENT: Recommend ways to make the text more engaging and compelling

ADVANCED CATEGORIES (BASED ON ACADEMIC LEVEL):
${additionalCategories}

${analysisDepth}

${assignmentGuidance}

VOCABULARY LEVEL: Target ${vocabularyLevel} vocabulary appropriate for ${academicLevel} level.

TONE EXPECTATION: ${toneRecommendation}

${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : ''}

IMPORTANT GUIDELINES:
- Grammar and spelling corrections apply across all levels
- For missing capitalization: suggest ONLY capitalizing the first letter, don't change the rest
- For missing punctuation: CAREFULLY CHECK if punctuation already exists - suggest ONLY adding a period if there's truly no punctuation at the end
- BEFORE suggesting punctuation: verify the sentence doesn't already end with a period, question mark, or exclamation point
- Don't suggest fancy formatting like "Hello, World!" unless specifically appropriate
- Prefer simple, minimal changes that fix specific issues
- Each suggestion should address ONE specific issue
- CRITICAL: Do not suggest adding periods if one already exists - check the exact end of the sentence carefully

MIDDLE SCHOOL SPECIFIC GUIDELINES:
- Focus primarily on complete sentences and basic punctuation
- Be encouraging and positive in all feedback
- Only flag very obvious errors that clearly need fixing
- Suggest simple word improvements but don't overwhelm with vocabulary changes
- Help with basic sentence variety (Don't start every sentence with "I")
- Keep explanations simple and easy to understand
- Don't flag minor issues - focus on clarity and basic correctness

HIGH SCHOOL SPECIFIC GUIDELINES:
- Flag obvious run-on sentences (more than 25 words with multiple clauses) but be more forgiving than undergraduate
- Suggest quotation marks for dialogue but focus on clarity over perfect punctuation
- Flag very informal phrases like "a lot", "kind of", "really cool" but allow "really changed" and "very much"
- Suggest basic transitions (First, Next, However, Therefore) but don't demand sophisticated connectors
- Encourage better word choices but don't require advanced vocabulary
- Help with paragraph structure - each paragraph should have a clear main idea
- Focus on making sure ideas are complete and connected logically

UNDERGRADUATE SPECIFIC GUIDELINES:
- ALWAYS flag run-on sentences that contain multiple independent clauses with just "and" or no connectors
- ALWAYS suggest proper quotation marks around dialogue (e.g., 'he said "Thank you very much"')
- ALWAYS flag informal phrases like "really changed", "very much", "a lot", "kind of" and suggest academic alternatives
- ALWAYS suggest better transitions between sentences (However, Furthermore, Consequently, etc.)
- ALWAYS challenge basic vocabulary choices and suggest more sophisticated alternatives
- FLAG sentences that start abruptly without connection to previous thoughts

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
- type: "spelling" | "clarity" | "engagement" | "grammar" | "tone" | "structure" | "depth" | "vocabulary"
- category: "error" | "improvement" | "enhancement"
- severity: "low" | "medium" | "high"
- originalText: the exact text to be replaced
- suggestedText: the improved version
- explanation: why this change is recommended
- grammarRule: the specific grammar rule or error type (e.g., "Subject-Verb Agreement", "Missing Apostrophe", "Spelling Error")
- educationalExplanation: a clear, simple explanation suitable for the target academic level
- example: a simple example sentence demonstrating the correct usage
- confidence: a number between 0 and 1 indicating confidence in the suggestion
- academicLevel: "${academicLevel}"
- assignmentType: "${assignmentType}"

Return the response as a JSON object with a "suggestions" array.`;
}



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

    const { content, documentId, userId, analysisType = 'full', previouslyModifiedAreas = [], writingGoals } = request.data;

    if (!content || !documentId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing required parameters');
    }

    logger.info('📚 Writing Goals received by Cloud Function:', writingGoals);

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
      return await generateMockSuggestions(content, documentId, userId, startTime, writingGoals);
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
          content: generateSystemPrompt(writingGoals)
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
        grammarRule: suggestion.grammarRule,
        educationalExplanation: suggestion.educationalExplanation,
        example: suggestion.example,
        startIndex,
        endIndex: endIndex,
        confidence: suggestion.confidence,
        status: 'pending',
        analysisId,
        academicLevel: writingGoals?.academicLevel,
        assignmentType: writingGoals?.assignmentType,
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
async function generateMockSuggestions(content: string, documentId: string, userId: string, startTime: number, writingGoals?: any) {
  const mockSuggestions = [];
  const analysisId = `mock_analysis_${Date.now()}`;
  const academicLevel = writingGoals?.academicLevel || 'high-school';
  const assignmentType = writingGoals?.assignmentType || 'essay';

  // Check for common spelling errors with specific rules
  const spellingErrors = [
    { 
      wrong: 'teh', 
      correct: 'the',
      rule: 'Common Misspelling',
      explanation: 'This is a common typo. Always double-check "the" - it\'s the most used word in English.',
      example: 'The cat sat on the mat.'
    },
    { 
      wrong: 'freind', 
      correct: 'friend',
      rule: 'I Before E Rule',
      explanation: 'Remember: "i before e except after c." Friend follows this rule.',
      example: 'My friend and I went to the store.'
    },
    { 
      wrong: 'recieve', 
      correct: 'receive',
      rule: 'I Before E Exception',
      explanation: 'Exception to "i before e": use "ei" after "c" as in "receive."',
      example: 'I will receive the package tomorrow.'
    },
    { 
      wrong: 'definately', 
      correct: 'definitely',
      rule: 'Double Letters',
      explanation: 'Remember: "definitely" has "i" not "a" in the middle.',
      example: 'I will definitely be there on time.'
    },
    { 
      wrong: 'seperate', 
      correct: 'separate',
      rule: 'Vowel Confusion',
      explanation: 'Use "a" not "e" in the middle: sep-a-rate.',
      example: 'Please separate the red and blue items.'
    },
    { 
      wrong: 'occured', 
      correct: 'occurred',
      rule: 'Double Consonants',
      explanation: 'Double the "r" when adding "-ed" to words ending in consonant-vowel-consonant.',
      example: 'The accident occurred yesterday.'
    },
    { 
      wrong: 'accomodate', 
      correct: 'accommodate',
      rule: 'Double Letters',
      explanation: 'Remember: accommodate has double "c" and double "m".',
      example: 'The hotel can accommodate 200 guests.'
    },
    { 
      wrong: 'neccessary', 
      correct: 'necessary',
      rule: 'Single vs Double Letters',
      explanation: 'One "c" and double "s": nec-es-sary.',
      example: 'It is necessary to study for the test.'
    },
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
        explanation: error.explanation,
        grammarRule: error.rule,
        educationalExplanation: error.explanation,
        example: error.example,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95,
        status: 'pending',
        analysisId,
        academicLevel,
        assignmentType,
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
      grammarRule: 'Word Repetition',
      educationalExplanation: `Avoid repeating the same word twice in a row. It makes your writing clearer and more professional.`,
      example: `Correct: "The big house" (not "The big big house")`,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      confidence: 0.8,
      status: 'pending',
      analysisId,
      academicLevel,
      assignmentType,
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

  // Check for specific grammar patterns
  const grammarChecks = [
    // Missing apostrophes in contractions
    {
      from: /\b(dont|doesnt|wont|cant|shouldnt|wouldnt|couldnt)\b/gi,
      to: (match: string) => {
        const corrections: { [key: string]: string } = {
          'dont': "don't", 'doesnt': "doesn't", 'wont': "won't", 
          'cant': "can't", 'shouldnt': "shouldn't", 'wouldnt': "wouldn't", 'couldnt': "couldn't"
        };
        return corrections[match.toLowerCase()] || match;
      },
      rule: 'Missing Apostrophe',
      explanation: 'Contractions need apostrophes to show missing letters.',
      example: "She doesn't like ice cream."
    },
    // Subject-verb agreement errors
    {
      from: /\b(he|she|it)\s+(dont)\b/gi,
      to: (match: string) => {
        const parts = match.split(/\s+/);
        return `${parts[0]} doesn't`;
      },
      rule: 'Subject-Verb Agreement',
      explanation: "Use 'doesn't' with 'he/she/it' subjects. 'Don't' is used with 'I/you/they/we'.",
      example: "She doesn't like bananas."
    }
  ];

  // Process grammar checks BEFORE other suggestions
  grammarChecks.forEach(grammarCheck => {
    let match: RegExpExecArray | null;
    grammarCheck.from.lastIndex = 0; // Reset regex state
    
    while ((match = grammarCheck.from.exec(content)) !== null) {
      const originalText = match[0];
      const suggestedText = grammarCheck.to(originalText);

      // Skip if no actual change
      if (suggestedText === originalText) {
        continue;
      }

              const suggestionData = {
          documentId,
          userId,
          type: 'grammar',
          category: 'error',
          severity: 'high',
          originalText,
          suggestedText,
          explanation: grammarCheck.explanation,
          grammarRule: grammarCheck.rule,
          educationalExplanation: grammarCheck.explanation,
          example: grammarCheck.example,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.95,
          status: 'pending',
          analysisId,
          academicLevel,
          assignmentType,
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
    { 
      weak: 'very good', 
      strong: 'excellent', 
      type: 'engagement',
      rule: 'Strong Adjectives',
      explanation: 'Use strong, specific adjectives instead of weak modifiers like "very."',
      example: 'The movie was excellent (not "very good").'
    },
    { 
      weak: 'pretty nice', 
      strong: 'appealing', 
      type: 'engagement',
      rule: 'Precise Language',
      explanation: 'Replace vague phrases with specific, descriptive words.',
      example: 'The design is appealing (not "pretty nice").'
    },
    { 
      weak: 'kind of', 
      strong: 'somewhat', 
      type: 'clarity',
      rule: 'Formal Writing',
      explanation: 'Use "somewhat" instead of the informal "kind of" in formal writing.',
      example: 'I am somewhat tired (not "kind of tired").'
    },
    { 
      weak: 'a lot of', 
      strong: 'many', 
      type: 'clarity',
      rule: 'Quantifier Precision',
      explanation: 'Use specific quantifiers like "many" instead of vague phrases.',
      example: 'There are many books (not "a lot of books").'
    },
    { 
      weak: 'really cool', 
      strong: 'impressive', 
      type: 'engagement',
      rule: 'Professional Tone',
      explanation: 'Use formal adjectives in professional writing instead of casual terms.',
      example: 'The technology is impressive (not "really cool").'
    },
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
        explanation: phrase.explanation,
        grammarRule: phrase.rule,
        educationalExplanation: phrase.explanation,
        example: phrase.example,
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

// Function to analyze essay structure
export const analyzeEssayStructure = onCall({
  secrets: [openaiApiKey]
}, async (request) => {
  const startTime = Date.now();
  
  try {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { content, documentId, userId, assignmentType = 'essay', academicLevel = 'high-school' } = request.data;

    if (!content || !documentId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Structure analysis is only available for essays
    if (assignmentType !== 'essay') {
      throw new HttpsError('invalid-argument', 'Structure analysis is only available for essay assignments');
    }

    // Verify user can only analyze their own documents
    if (request.auth.uid !== userId) {
      throw new HttpsError('permission-denied', 'User can only analyze their own documents');
    }

    logger.info(`Analyzing essay structure for document ${documentId}`, { 
      userId, 
      contentLength: content.length,
      assignmentType,
      academicLevel
    });

    // Generate structure analysis prompt
    const structurePrompt = generateStructureAnalysisPrompt(assignmentType, academicLevel);

    // Check if OpenAI is configured
    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      logger.warn('OpenAI API key not configured, returning mock structure analysis');
      return await generateMockStructureAnalysis(content, documentId, userId, startTime, assignmentType, academicLevel);
    }

    // Initialize OpenAI with the API key
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Call OpenAI GPT-4o API for structure analysis
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: structurePrompt
        },
        {
          role: 'user',
          content: `Please analyze the structure of this ${assignmentType} and identify its sections: "${content}"`
        }
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new HttpsError('internal', 'No response from OpenAI');
    }

    // Parse the JSON response
    let analysisResult;
    try {
      logger.info('OpenAI structure analysis raw response:', {
        response: responseText,
        responseLength: responseText.length,
        finishReason: completion.choices[0]?.finish_reason
      });
      
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse structure analysis response from OpenAI:', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText,
        responseLength: responseText.length,
        finishReason: completion.choices[0]?.finish_reason
      });
      throw new HttpsError('internal', 'Invalid response format from OpenAI');
    }

    // Fix body paragraph numbering - OpenAI might return overall paragraph numbers
    if (analysisResult.sections) {
      let bodyParagraphCount = 0;
      for (const section of analysisResult.sections) {
        if (section.type === 'body-paragraph') {
          bodyParagraphCount++;
          if (section.metadata) {
            section.metadata.paragraphNumber = bodyParagraphCount;
          }
        }
      }
    }

    // Process and save structure analysis to Firestore  
    const analysisId = `structure_analysis_${Date.now()}`;
    const structureData = {
      documentId,
      userId,
      sections: analysisResult.sections || [],
      overallStructure: analysisResult.overallStructure || {},
      analysisId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Save structure analysis
    const structureRef = db.collection('essayStructures').doc();
    await structureRef.set(structureData);

    // Process structure suggestions and save to suggestions collection
    const batch = db.batch();
    const structureSuggestions = [];

    for (const suggestion of analysisResult.structureSuggestions || []) {
      const suggestionData = {
        documentId,
        userId,
        type: 'structure',
        category: suggestion.category || 'improvement',
        severity: suggestion.severity || 'medium',
        originalText: suggestion.originalText || '',
        suggestedText: suggestion.suggestedText || '',
        explanation: suggestion.explanation || '',
        grammarRule: 'Essay Structure',
        educationalExplanation: suggestion.educationalExplanation || suggestion.explanation,
        example: suggestion.example || '',
        startIndex: suggestion.startIndex || 0,
        endIndex: suggestion.endIndex || 0,
        confidence: suggestion.confidence || 0.8,
        status: 'pending',
        analysisId,
        academicLevel,
        assignmentType,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const suggestionRef = db.collection('suggestions').doc();
      batch.set(suggestionRef, suggestionData);
      structureSuggestions.push({
        id: suggestionRef.id,
        ...suggestionData,
      });
    }

    await batch.commit();

    const processingTime = Date.now() - startTime;

    logger.info(`Structure analysis completed for document ${documentId}`, {
      sectionsFound: analysisResult.sections?.length || 0,
      structureSuggestions: structureSuggestions.length,
      processingTime,
      analysisId,
    });

    return {
      structure: {
        id: structureRef.id,
        ...structureData,
      },
      structureSuggestions,
      analysisId,
      processingTime,
      tokenUsage: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };

  } catch (error) {
    logger.error('Error in analyzeEssayStructure:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to analyze essay structure');
  }
});

// Generate structure analysis system prompt
function generateStructureAnalysisPrompt(assignmentType: string, academicLevel: string): string {
  const levelGuidance = {
    'middle-school': {
      expectations: 'Simple 3-5 paragraph structure with clear introduction, body, and conclusion',
      thesisRequirement: 'Basic thesis statement that states the main idea',
      bodyRequirement: '2-3 body paragraphs with topic sentences and supporting details',
      conclusionRequirement: 'Simple conclusion that restates the main idea'
    },
    'high-school': {
      expectations: '4-6 paragraph structure with sophisticated introduction, multiple body paragraphs, and strong conclusion',
      thesisRequirement: 'Clear, arguable thesis statement with preview of main points',
      bodyRequirement: '3-4 well-developed body paragraphs with topic sentences, evidence, and analysis',
      conclusionRequirement: 'Conclusion that synthesizes main points and provides closure'
    },
    'undergrad': {
      expectations: 'Complex multi-paragraph structure with nuanced introduction, substantial body, and insightful conclusion',
      thesisRequirement: 'Sophisticated, arguable thesis with clear position and complex reasoning',
      bodyRequirement: '4+ well-developed paragraphs with strong topic sentences, substantial evidence, thorough analysis, and smooth transitions',
      conclusionRequirement: 'Conclusion that synthesizes arguments, addresses implications, and suggests further research or action'
    }
  };

  const level = levelGuidance[academicLevel as keyof typeof levelGuidance] || levelGuidance['high-school'];

  return `You are an expert writing instructor specializing in ${assignmentType} structure analysis for ${academicLevel} level writing.

Analyze the provided text and identify its structural components. Return a JSON object with the following structure:

{
  "sections": [
    {
      "id": "unique_section_id",
      "type": "introduction" | "thesis" | "body-paragraph" | "conclusion" | "transition",
      "startIndex": number,
      "endIndex": number,
      "text": "actual text content",
      "confidence": number (0-1),
      "isWeak": boolean,
      "suggestions": ["list of improvement suggestions"],
      "metadata": {
        "paragraphNumber": number, // For body paragraphs: 1, 2, 3, etc. (not overall paragraph position)
        "topicSentence": {
          "startIndex": number,
          "endIndex": number,
          "text": "topic sentence text"
        },
        "evidenceCount": number,
        "transitionQuality": "weak" | "moderate" | "strong"
      }
    }
  ],
  "overallStructure": {
    "hasIntroduction": boolean,
    "hasThesis": boolean,
    "bodyParagraphCount": number,
    "hasConclusion": boolean,
    "structureScore": number (0-1),
    "missingElements": ["list of missing structural elements"],
    "weakElements": [section objects that are weak]
  },
  "structureSuggestions": [
    {
      "originalText": "text to improve",
      "suggestedText": "improved version",
      "explanation": "why this improvement is needed",
      "educationalExplanation": "educational explanation for student",
      "example": "example of good structure",
      "startIndex": number,
      "endIndex": number,
      "confidence": number,
      "category": "error" | "improvement" | "enhancement",
      "severity": "low" | "medium" | "high"
    }
  ]
}

LEVEL-SPECIFIC EXPECTATIONS (${academicLevel.toUpperCase()}):
- Overall Structure: ${level.expectations}
- Thesis: ${level.thesisRequirement}
- Body Paragraphs: ${level.bodyRequirement}
- Conclusion: ${level.conclusionRequirement}

 ANALYSIS GUIDELINES:
 1. Identify paragraph boundaries (usually separated by double line breaks or clear topic shifts)
 2. Classify each paragraph as introduction, body, or conclusion
 3. Within the introduction, identify the thesis statement (usually the last sentence)
 4. For body paragraphs, identify topic sentences (usually first sentence)
 5. Assess transition quality between paragraphs (see TRANSITION ANALYSIS below)
 6. Evaluate overall structural coherence and completeness

 PARAGRAPH NUMBERING RULES:
 - For body paragraphs ONLY: use sequential numbering 1, 2, 3, etc. (NOT overall paragraph position)
 - Example: If essay has Introduction + 3 Body + Conclusion, body paragraphs should be numbered 1, 2, 3
 - Introduction and conclusion paragraphs can use overall position numbers

 TRANSITION ANALYSIS - Rate transitions between paragraphs using these EXACT word lists:
 
 WEAK transitions (basic/problematic words at paragraph start):
 - "and", "but", "so", "then", "also", "too", "plus", "or", "next", "first", "second", "third", "another"
 - No connecting words or phrases between paragraphs
 - Abrupt topic changes without logical connection
 
 MODERATE transitions (standard academic words/phrases at paragraph start):
 - "however", "therefore", "additionally", "first of all", "secondly", "thirdly", "finally"
 - "in conclusion", "in summary", "for example", "on the other hand", "on the contrary"
 - "as a result", "in fact", "indeed", "for instance", "such as", "in other words"
 - "that is", "namely", "in contrast", "similarly"
 
 STRONG transitions (sophisticated academic words/phrases at paragraph start):
 - "nevertheless", "consequently", "furthermore", "moreover", "conversely"
 - "alternatively", "specifically", "particularly", "meanwhile", "ultimately"
 - "building upon", "expanding on", "in addition to", "contrary to", "despite this"
 - "notwithstanding", "concurrently", "simultaneously", "in light of", "given that"

 CLASSIFICATION RULES:
 1. Look ONLY at the first few words of each paragraph (after the first paragraph)
 2. Match the EXACT words/phrases from the lists above
 3. If a paragraph starts with a WEAK transition word, mark as "weak"
 4. If a paragraph starts with a MODERATE transition word/phrase, mark as "moderate"  
 5. If a paragraph starts with a STRONG transition word/phrase, mark as "strong"
 6. If no transition words are found, mark as "weak"

 ACADEMIC LEVEL TRANSITION REQUIREMENTS:
 - MIDDLE SCHOOL: Any transition attempt is acceptable (weak/moderate/strong all OK)
 - HIGH SCHOOL: Flag weak transitions as needing improvement (moderate/strong acceptable)
 - UNDERGRADUATE: Flag weak AND moderate transitions as needing improvement (only strong acceptable)

 CRITICAL: For accurate highlighting, ensure startIndex and endIndex are precise:
 - Use content.indexOf() to find exact positions
 - Account for whitespace and line breaks exactly as they appear
 - Test: content.slice(startIndex, endIndex) should exactly match the section text
 - If there are multiple occurrences of similar text, use context to identify the correct instance

MARKING WEAK SECTIONS: Mark sections as weak if they:
- Lack clear topic sentences (body paragraphs)
- Have insufficient development or evidence
- Don't connect clearly to the thesis
- Have poor transitions to adjacent sections (based on academic level requirements)
- Are missing entirely when expected

TRANSITION-BASED WEAKNESS RULES:
- For MIDDLE SCHOOL: No sections marked weak due to transitions (all acceptable)
- For HIGH SCHOOL: Mark body paragraphs as weak if they start with WEAK transitions
- For UNDERGRADUATE: Mark body paragraphs as weak if they start with WEAK OR MODERATE transitions

SUGGESTION CATEGORIES:
- "error": Missing required elements (thesis, conclusion, etc.)
- "improvement": Weak elements that need strengthening
- "enhancement": Good elements that could be made even better

Focus on structural issues, not grammar or word choice. Provide specific, actionable feedback.`;
}

// Mock structure analysis when OpenAI is not available
async function generateMockStructureAnalysis(
  content: string, 
  documentId: string, 
  userId: string, 
  startTime: number,
  assignmentType: string,
  academicLevel: string
) {
  const analysisId = `mock_structure_${Date.now()}`;
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const sections: any[] = [];
  let currentIndex = 0;

  // Helper function to analyze transition quality
  const analyzeTransitionQuality = (paragraph: string, prevParagraph: string | null, academicLevel: string): 'weak' | 'moderate' | 'strong' => {
    if (!prevParagraph) return 'strong'; // No previous paragraph to transition from
    
    const firstSentence = paragraph.split('.')[0].toLowerCase().trim();
    const firstFewWords = firstSentence.split(' ').slice(0, 8).join(' '); // Check first 8 words
    
    logger.info(`=== TRANSITION ANALYSIS ===`);
    logger.info(`Academic Level: ${academicLevel}`);
    logger.info(`Full first sentence: "${firstSentence}"`);
    logger.info(`First 8 words: "${firstFewWords}"`);
    logger.info(`Previous paragraph exists: ${!!prevParagraph}`);
    
    // Strong transition indicators (sophisticated academic writing)
    const strongTransitions = [
      'nevertheless', 'consequently', 'furthermore', 'moreover', 'conversely', 
      'alternatively', 'specifically', 'particularly', 'meanwhile', 'ultimately',
      'building upon', 'expanding on', 'in addition to', 'contrary to', 'despite this',
      'notwithstanding', 'concurrently', 'simultaneously', 'in light of', 'given that'
    ];
    
    // Moderate transition indicators (standard academic writing)
    const moderateTransitions = [
      'however', 'therefore', 'additionally', 'first of all', 'secondly', 'thirdly',
      'finally', 'in conclusion', 'in summary', 'for example', 'on the other hand', 
      'on the contrary', 'as a result', 'in fact', 'indeed', 'for instance', 
      'such as', 'in other words', 'that is', 'namely', 'in contrast', 'similarly'
    ];
    
    // Weak transition indicators (basic/problematic)
    const weakTransitions = [
      'and', 'but', 'so', 'then', 'also', 'too', 'plus', 'or', 'next', 'first', 'second', 'third', 'another'
    ];
    
    // Check for strong transitions first (exact matching)
    for (const trans of strongTransitions) {
      if (firstSentence.startsWith(trans + ' ') || firstSentence.startsWith(trans + ',') || 
          (firstSentence.startsWith(trans) && (firstSentence.length === trans.length || firstSentence[trans.length] === ' ' || firstSentence[trans.length] === ','))) {
        logger.info(`Found STRONG transition: "${trans}"`);
        return 'strong';
      }
    }
    
    // Check for moderate transitions (exact matching)
    for (const trans of moderateTransitions) {
      if (firstSentence.startsWith(trans + ' ') || firstSentence.startsWith(trans + ',') || 
          (firstSentence.startsWith(trans) && (firstSentence.length === trans.length || firstSentence[trans.length] === ' ' || firstSentence[trans.length] === ','))) {
        logger.info(`Found MODERATE transition: "${trans}"`);
        return 'moderate';
      }
    }
    
    // Check for weak transitions (exact matching)
    for (const trans of weakTransitions) {
      if (firstSentence.startsWith(trans + ' ') || firstSentence.startsWith(trans + ',') || 
          (firstSentence.startsWith(trans) && (firstSentence.length === trans.length || firstSentence[trans.length] === ' ' || firstSentence[trans.length] === ','))) {
        logger.info(`Found WEAK transition: "${trans}"`);
        return 'weak';
      }
    }
    
    // No clear transition found
    logger.info(`No clear transition found - marking as WEAK`);
    return 'weak';
  };

  // Helper function to generate transition suggestions based on academic level
  const generateTransitionSuggestions = (transitionQuality: string, academicLevel: string, sectionType: string): string[] => {
    const suggestions: string[] = [];
    
    if (academicLevel === 'middle-school') {
      // Middle school: any transition is okay, just encourage improvement
      if (transitionQuality === 'weak') {
        suggestions.push('Consider adding a transition word like "First," "Next," or "Finally" to connect your ideas.');
      }
    } else if (academicLevel === 'high-school') {
      // High school: flag weak transitions
      if (transitionQuality === 'weak') {
        suggestions.push('Add a stronger transition phrase like "However," "Therefore," or "Additionally" to improve flow.');
        suggestions.push('Connect this paragraph to the previous one more clearly.');
      }
    } else if (academicLevel === 'undergrad') {
      // Undergraduate: flag weak and moderate transitions
      if (transitionQuality === 'weak') {
        suggestions.push('Use sophisticated transitions like "Nevertheless," "Consequently," or "In contrast" for academic writing.');
        suggestions.push('Create explicit connections that explain the relationship between paragraphs.');
      } else if (transitionQuality === 'moderate') {
        suggestions.push('Enhance this transition with more sophisticated language and explicit connections.');
        suggestions.push('Reference specific content from the previous paragraph to create seamless flow.');
      }
    }
    
    return suggestions;
  };

  // Analyze each paragraph
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const startIndex = content.indexOf(paragraph, currentIndex);
    const endIndex = startIndex + paragraph.length;
    
    logger.info(`Mock analysis - Paragraph ${i + 1}:`, {
      paragraph: paragraph.substring(0, 50) + '...',
      startIndex,
      endIndex,
      length: paragraph.length
    });
    
    let sectionType: 'introduction' | 'body-paragraph' | 'conclusion';
    if (i === 0) {
      sectionType = 'introduction';
    } else if (i === paragraphs.length - 1 && paragraphs.length > 2) {
      sectionType = 'conclusion';
    } else {
      sectionType = 'body-paragraph';
    }

    // Analyze transition quality for body paragraphs
    const prevParagraph = i > 0 ? paragraphs[i - 1] : null;
    const transitionQuality = sectionType === 'body-paragraph' ? 
      analyzeTransitionQuality(paragraph, prevParagraph, academicLevel) : undefined;
    
    logger.info(`Section ${i + 1} (${sectionType}) transition analysis:`, {
      academicLevel,
      transitionQuality,
      firstWords: paragraph.split(' ').slice(0, 5).join(' ')
    });
    
    // Generate suggestions based on paragraph content and academic level
    const suggestions: string[] = [];
    
    // Length-based suggestions
    if (paragraph.length < 100) {
      suggestions.push('Paragraph needs more development and supporting details');
    }
    
    // Transition-based suggestions
    if (transitionQuality) {
      const transitionSuggestions = generateTransitionSuggestions(transitionQuality, academicLevel, sectionType);
      suggestions.push(...transitionSuggestions);
    }
    
    // Academic level specific suggestions
    if (academicLevel === 'undergrad' && paragraph.length < 200) {
      suggestions.push('Undergraduate writing typically requires more substantial paragraph development');
    }

    // Determine if section is weak based on academic level and transition quality
    let isWeak = paragraph.length < 100; // Always weak if too short
    
    if (transitionQuality) {
      if (academicLevel === 'undergrad') {
        // Undergraduate: only strong transitions are acceptable
        isWeak = isWeak || (transitionQuality !== 'strong');
      } else if (academicLevel === 'high-school') {
        // High school: weak transitions are problematic
        isWeak = isWeak || (transitionQuality === 'weak');
      }
      // Middle school: any transition is acceptable, so no additional weakness from transitions
    }

    // Calculate the body paragraph number (only for body paragraphs)
    let bodyParagraphNumber = undefined;
    if (sectionType === 'body-paragraph') {
      // Count how many body paragraphs we've seen so far
      bodyParagraphNumber = sections.filter(s => s.type === 'body-paragraph').length + 1;
    }

    sections.push({
      id: `section_${i}`,
      type: sectionType,
      startIndex,
      endIndex,
      text: paragraph,
      confidence: 0.8,
      isWeak,
      suggestions,
      metadata: {
        paragraphNumber: bodyParagraphNumber || (i + 1), // Use body paragraph number for body paragraphs, overall number for others
        topicSentence: sectionType === 'body-paragraph' ? {
          startIndex,
          endIndex: startIndex + Math.min(paragraph.indexOf('.') + 1, 100),
          text: paragraph.split('.')[0] + '.'
        } : undefined,
        evidenceCount: (paragraph.match(/\b(according to|research shows|studies indicate|for example|for instance)\b/gi) || []).length,
        transitionQuality
      }
    });

    currentIndex = endIndex;
  }

  // Check for missing elements
  const missingElements = [];
  if (paragraphs.length < 3) {
    missingElements.push('Essay needs more paragraphs for proper structure');
  }
  if (!content.toLowerCase().includes('thesis') && !content.includes('argue') && !content.includes('believe')) {
    missingElements.push('Thesis statement may be missing or unclear');
  }

  const structureData = {
    documentId,
    userId,
    sections,
    overallStructure: {
      hasIntroduction: paragraphs.length > 0,
      hasThesis: content.length > 200,
      bodyParagraphCount: Math.max(0, paragraphs.length - 2),
      hasConclusion: paragraphs.length > 2,
      structureScore: Math.min(1, paragraphs.length / 5),
      missingElements,
      weakElements: sections.filter(s => s.isWeak)
    },
    analysisId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Save mock structure analysis
  const structureRef = db.collection('essayStructures').doc();
  await structureRef.set(structureData);

  const processingTime = Date.now() - startTime;

  return {
    structure: {
      id: structureRef.id,
      ...structureData,
    },
    structureSuggestions: [],
    analysisId,
    processingTime,
    tokenUsage: { prompt: 0, completion: 0, total: 0 },
  };
}

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
        structure: suggestions.filter(s => s.type === 'structure').length,
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
