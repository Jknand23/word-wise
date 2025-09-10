/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
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

// CORS options
const corsOptions = {
  cors: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "https://wordwise-ai-3a4e1.web.app"],
};

const commonOptions = {
  ...corsOptions,
  secrets: [openaiApiKey],
};

// Choose OpenAI model
const OPENAI_MODEL = "gpt-4o"; // Upgraded from gpt-4-turbo-preview

// Generate system prompt based on writing goals
type WritingGoals = {
  academicLevel?: 'middle-school' | 'high-school' | 'undergrad' | 'graduate';
  grammarStrictness?: 'lenient' | 'moderate' | 'strict';
};

function generateSystemPrompt(writingGoals?: WritingGoals): string {
  const level = writingGoals?.academicLevel || 'high-school';
  const base = (categories: string, levelSpecific: string) => `${categories}

${levelSpecific}

CRITICAL PUNCTUATION DETECTION RULES:
- ALWAYS analyze text for missing end punctuation (., !, ?)
- ANY sentence that ends without punctuation MUST have a punctuation suggestion
- Detect and fix apostrophes in contractions (dont → don't)

CONFIDENCE RULES:
- After suggesting a change to wording (clarity, engagement, vocabulary), assume the new text is correct.
- Do NOT immediately propose synonyms for newly suggested words unless the original meaning is still unclear.
- Only suggest alternative wording if it fixes an objective problem (ambiguity, incorrect meaning), not stylistic preference.

ANTI-ENDLESS SUGGESTION RULES (concise):
- Do not repeat the same suggestion once accepted.

Return suggestions as JSON with a 'suggestions' array.`;

  const commonCategories = `You are an expert writing assistant. Carefully review the text and propose concrete fixes.

MANDATORY OUTPUT REQUIREMENTS:
- Return **at least 15** actionable suggestions (combine categories as needed).
- If the passage is short, still supply every possible improvement—do not leave the array empty.
- Each suggestion must fall into exactly one of these categories (use lowercase):
  1. spelling
  2. grammar (strictness: ${writingGoals?.grammarStrictness || 'moderate'})
  3. clarity
  4. engagement

For each suggestion, provide:
- type: "spelling" | "grammar" | "clarity" | "engagement" (lowercase)
- category: "error" | "improvement" | "enhancement" 
- severity: "low" | "medium" | "high"
- originalText: exact text to replace
- suggestedText: improved version
- explanation: clear reason for the change
- confidence: number between 0 and 1

If no issues are found for a category, redistribute focus to other categories to keep the minimum count.`;

  switch (level) {
    case 'middle-school':
      return base(commonCategories, `MIDDLE SCHOOL FOCUS:
- EMPHASIZE CLARITY AND SIMPLE SENTENCE STRUCTURE: Fix run-on sentences, sentence fragments, basic punctuation errors
- FIX BASIC GRAMMAR: Subject-verb agreement, apostrophes, comma usage, end punctuation
- ENCOURAGE CLEAR PARAGRAPH STRUCTURE: Topic sentences followed by supporting details, paragraph organization
- RECOMMEND MORE SPECIFIC WORD CHOICES: Replace vague words with clearer, more precise alternatives
- Use simple, encouraging explanations that build confidence
- Avoid complex grammatical terminology - use student-friendly language`);
    case 'undergrad':
      return base(commonCategories, `UNDERGRADUATE FOCUS:
- PUSH FOR DEPTH IN ARGUMENT AND CRITICAL THINKING: Challenge shallow analysis, demand evidence-based reasoning
- ENSURE ADVANCED CLARITY IN COMPLEX SENTENCE STRUCTURES: Fix sophisticated syntax issues, parallel structure, subordination
- RECOMMEND PRECISE ACADEMIC LANGUAGE AND CITATION INTEGRATION: Suggest disciplinary terminology, formal academic tone
- FOCUS ON GLOBAL COHERENCE AND DISCIPLINE-SPECIFIC TONE: Overall argument flow, field-appropriate language
- Expect sophisticated writing competency - flag informal language aggressively
- Demand rigorous analysis and evidence-based arguments`);
    default: /* high-school */
      return base(commonCategories, `HIGH SCHOOL FOCUS:
- SUPPORT THESIS CLARITY AND ARGUMENT STRUCTURE: Help develop clear thesis statements, logical argument flow
- SUGGEST SMOOTHER TRANSITIONS AND SENTENCE VARIETY: Improve paragraph connections, varied sentence structures
- IMPROVE TONE AND FORMALITY FOR ACADEMIC WRITING: Move toward formal academic voice, reduce casual language
- HELP INTEGRATE EVIDENCE AND AVOID VAGUE OR REDUNDANT PHRASING: Support claims with specific examples, eliminate wordiness
- Balance fundamentals with advanced skills - prepare for college-level writing
- Encourage development of sophisticated argumentation while maintaining accessibility`);
  }
}

// System prompt for parsing assignment rubrics
const parseRubricPrompt = `You are an expert at analyzing assignment prompts and grading rubrics. Your task is to extract key details and structure them into a JSON object.

Analyze the provided text and extract the following information:
1.  **assignmentType**: Best guess from 'essay', 'reflection', 'report', 'research-paper', 'creative-writing', 'other'.
2.  **academicLevel**: Best guess from 'middle-school', 'high-school', 'undergrad', 'graduate'.
3.  **extractedRequirements**: An object containing specific, quantifiable requirements.
    -   **wordCount**: { "min": number, "max": number }
    -   **citationCount**: { "min": number, "style": "APA" | "MLA" | "Chicago" | "Harvard" }
    -   **structure**: An array of required structural elements (e.g., "introduction", "thesis", "conclusion").
    -   **tone**: A brief description of the expected tone (e.g., "Formal and academic").
4.  **criteria**: An array of grading criteria. For each criterion, extract:
    -   **id**: A unique snake_case identifier (e.g., "content_quality").
    -   **name**: The name of the criterion (e.g., "Content Quality").
    -   **description**: A detailed description of what is being evaluated.
    -   **maxScore**: The maximum points for this criterion.
    -   **weight**: The weight of this criterion in the overall grade (0-1). If not specified, calculate as 1 / (number of criteria).
    -   **type**: The type of evaluation from 'count', 'quality', 'presence', 'structure', 'tone', 'length'.
    -   **levels**: An array of scoring levels. For each level, extract:
        -   **id**: A unique identifier for the level.
        -   **score**: The point value for the level.
        -   **description**: The description of the performance at this level (e.g., "Excellent", "Proficient").

IMPORTANT:
- If a value isn't present in the text, omit the key.
- Provide a complete JSON object.

Example Input:
"History 101: Research Paper. 1500-2000 words. APA format. Min 5 sources. Due Dec 15.
Grading:
- Argument & Analysis (50%): Clear thesis, strong evidence.
- Structure (30%): Logical flow, proper formatting.
- Grammar & Style (20%): Free of errors.
Excellent (A): Exceeds all expectations. Good (B): Meets all expectations. Needs Improvement (C): Meets some expectations."

Example Output:
{
  "assignmentType": "research-paper",
  "academicLevel": "undergrad",
  "extractedRequirements": {
    "wordCount": { "min": 1500, "max": 2000 },
    "citationCount": { "min": 5, "style": "APA" },
    "structure": ["thesis", "evidence", "formatting", "flow"],
    "tone": "Formal and academic"
  },
  "criteria": [
    {
      "id": "argument_and_analysis",
      "name": "Argument & Analysis",
      "description": "Clear thesis, strong evidence.",
      "maxScore": 50,
      "weight": 0.5,
      "type": "quality",
      "levels": [
        { "id": "arg_excellent", "score": 50, "description": "Exceeds all expectations" },
        { "id": "arg_good", "score": 40, "description": "Meets all expectations" },
        { "id": "arg_needs_improvement", "score": 30, "description": "Meets some expectations" }
      ]
    },
    {
      "id": "structure",
      "name": "Structure",
      "description": "Logical flow, proper formatting.",
      "maxScore": 30,
      "weight": 0.3,
      "type": "structure",
      "levels": [
         { "id": "struct_excellent", "score": 30, "description": "Exceeds all expectations" },
         { "id": "struct_good", "score": 24, "description": "Meets all expectations" },
         { "id": "struct_needs_improvement", "score": 18, "description": "Meets some expectations" }
      ]
    },
    {
      "id": "grammar_and_style",
      "name": "Grammar & Style",
      "description": "Free of errors.",
      "maxScore": 20,
      "weight": 0.2,
      "type": "quality",
      "levels": [
        { "id": "gram_excellent", "score": 20, "description": "Exceeds all expectations" },
        { "id": "gram_good", "score": 16, "description": "Meets all expectations" },
        { "id": "gram_needs_improvement", "score": 12, "description": "Meets some expectations" }
      ]
    }
  ]
}`;

function generateAnalyzeWithRubricPrompt(academicLevel = "high-school") {
  let systemPrompt = "";

  // Base instructions shared by all personas
  const baseInstructions = `
Your task is to analyze a user's text against a provided rubric, but you MUST do so through the specific persona and lens described below. Do not deviate from this persona.

**Process:**
1.  **Adopt Persona:** Fully adopt the persona assigned to you. All feedback and scoring must come from this viewpoint.
2.  **Interpret Rubric:** First, mentally re-interpret each criterion from the rubric through your persona's specific lens.
3.  **Analyze and Score:** Analyze the user's text, providing a score (0-1), feedback, and a list of met/missed expectations for each criterion.
4.  **Provide Output:** Return a valid JSON object with 'overallScore', 'overallFeedback', and 'criteriaResults'.
`;

  switch (academicLevel) {
    case "middle-school":
      systemPrompt = `
        **Your Persona: Experienced 7th-Grade English Teacher (Ms. Davis)**
        
        **CORE DIRECTIVE: You MUST follow this scoring rule.**
        - A thesis like "Given the significant impact of social media on our daily lives, it is crucial to understand both its benefits and drawbacks" receives a **PERFECT score of 1.0 (100%)**.
        - **Justification:** This meets the expectations for 7th grade writing. Your feedback should acknowledge it's solid work for their grade level while mentioning areas they can explore as they continue developing as writers.
        
        **Your General Approach (Based on the Core Directive):**
        - **Interpret Rubrics for Grade Level:** View all criteria through 7th-grade expectations. "Strong evidence" means they included relevant facts. "Good structure" means clear beginning, middle, and end.
        - **Be Encouraging but Realistic:** Acknowledge good work without being overly flattering. Use phrases like "This is good work for 7th grade" and "As you continue developing as a writer..."
        - **Scoring:** Give full credit when work meets grade-level expectations, but frame feedback as "meeting current expectations" rather than "perfect work."
        - **Future Growth:** Always include gentle suggestions for future development using phrases like "In future writing, you might explore..." or "As you advance to higher grades..."
      `;
      break;
    case "high-school":
      systemPrompt = `
        **Your Persona: Experienced High School English Teacher (Mr. Thompson)**

        **CORE DIRECTIVE: You MUST follow this scoring rule.**
        - A thesis like "Given the significant impact of social media on our daily lives, it is crucial to understand both its benefits and drawbacks" receives a score of **0.75 (75%)**.
        - **Justification:** This shows good understanding of the topic and meets basic high school expectations, but could be strengthened with a clearer position. Your feedback should acknowledge the solid foundation while guiding them toward more sophisticated argumentation.
        
        **Your General Approach (Based on the Core Directive):**
        - **Interpret Rubrics for High School Level:** View criteria through the lens of preparing students for college-level thinking. "Strong evidence" means relevant examples with some explanation. "Good structure" requires clear organization with topic sentences.
        - **Be Supportive yet Challenging:** Acknowledge what's working well, then provide specific guidance for taking their writing to the next level. Use phrases like "You've built a solid foundation" and "To strengthen this further..."
        - **Scoring:** Recognize competent high school work while encouraging growth. Frame feedback around "meeting expectations" vs "exceeding expectations" rather than focusing on deficits.
        - **College Preparation Focus:** Include gentle guidance about college-level expectations using phrases like "As you prepare for college writing..." or "This skill will serve you well in advanced courses..."
      `;
      break;
    case "undergrad":
      systemPrompt = `
        **Your Persona: University TA for a 100-Level History Course**

        **CORE DIRECTIVE: You MUST follow this scoring rule.**
        - A thesis like "Given the significant impact of social media on our daily lives, it is crucial to understand both its benefits and drawbacks" receives a score of **0.5 (50%)**.
        - **Justification:** This thesis is fundamentally insufficient for undergraduate work. It lacks a specific, complex, and contestable argument. Your feedback MUST be direct, stating that a university paper requires a real thesis, not a topic announcement. This is your most important instruction.

        **Your General Approach (Based on the Core Directive):**
        - **Interpret Rubrics for Analysis:** View all criteria through the lens of academic rigor. "Strong evidence" requires in-depth analysis. "Good structure" must persuasively advance the argument.
        - **Be Direct and Analytical:** Use professional, academic language. Focus on the strength of the argument and the quality of the analysis.
        - **Scoring:** Be rigorous. A score of 0.5 reflects the failure to present a university-level thesis. Higher scores require a genuine, debatable claim.
      `;
      break;
    case "graduate":
      systemPrompt = `
        **Your Persona: University Professor**
        You are a tenured professor evaluating a graduate student's seminar paper. Your standard is readiness for professional publication. You are exacting and critical.

        **Your Lens for Rubrics:**
        - **"Strong Thesis":** This must be an "original, nuanced, and significant scholarly intervention." It must clearly engage with and contribute to an existing academic debate.
        - **"Evidence/Support":** Evidence must be "expertly synthesized from primary and secondary sources" to support a complex argument.
        - **"Structure":** The structure must be "deliberate and sophisticated," serving the argument in a compelling, possibly innovative, way.

        **Your Approach to Feedback:**
        - **Be Critical and Scholarly:** Your feedback should read like a peer review. Challenge assumptions and push for deeper analysis.
        - **Focus on Contribution:** Does this work contribute to the field? Is the research sound?
        - **Scoring:** Be extremely demanding. A publishable-quality paper gets an "A" (0.95+). Anything less indicates a significant need for revision.
      `;
      break;
    default:
      // Default to high-school persona
      systemPrompt = `
        **Your Persona: 10th-Grade Honors English Teacher**
        Your name is Mr. Thompson. You are preparing students for college. You are helpful and clear, but you push students to develop real arguments.

        **Your Lens for Rubrics:**
        - **"Strong Thesis":** This must be an "arguable claim," not just a topic statement.
        - **"Evidence/Support":** This means "the student used a relevant fact/quote and then explained it for 1-2 sentences."
        - **"Structure":** This requires "clear topic sentences for each body paragraph."

        **Your Approach to Feedback:**
        - **Be Constructive:** Start with what's working, then clearly explain how to improve.
        - **Scoring:** Be fair. A solid effort gets a "B" (0.8-0.89). An "A" (0.9+) requires analysis.
      `;
  }

  return systemPrompt + baseInstructions;
}


/**
 * Wrapper for OpenAI API calls
 */
async function getOpenAICompletion(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.5,
) {
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey.value() });
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new HttpsError("internal", "No response content from OpenAI.");
    }

    try {
      return JSON.parse(responseContent);
    } catch {
      logger.warn("⚠️ OpenAI response was not valid JSON. Retrying with simplified instructions.");

      // Retry once with an explicit instruction to limit suggestions to 50 items
      const retryCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${userPrompt}\n\nLIMIT_SUGGESTIONS: Return no more than 50 suggestions.` },
        ],
        temperature,
        response_format: { type: "json_object" },
      });

      const retryContent = retryCompletion.choices[0].message.content;
      if (!retryContent) {
        throw new HttpsError("internal", "No response content from OpenAI on retry.");
      }

      try {
        return JSON.parse(retryContent);
      } catch {
        logger.error("❌ Failed to parse OpenAI retry response:", { retryContent });
        // Rethrow the original parse error for upstream handling
        throw new HttpsError("internal", "Failed to parse OpenAI JSON response.");
      }
    }
  } catch (error) {
    logger.error("Error calling OpenAI API:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to get completion from OpenAI.");
  }
}

/**
 * ===================================================================
 *                         SUGGESTION FUNCTIONS
 * ===================================================================
 */

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const RATE_LIMIT_COUNT = 1000; // 1000 requests per hour

async function checkRateLimit(userId: string) {
  const now = Date.now();
  const userRateLimitRef = db.collection("rateLimits").doc(userId);
  const userRateLimitDoc = await userRateLimitRef.get();

  if (!userRateLimitDoc.exists) {
    await userRateLimitRef.set({
      requests: [{ timestamp: now }],
    });
    return true;
  }

  const data = userRateLimitDoc.data();
  if (!data) return false;

  const recentRequests = (data.requests as Array<{ timestamp: number }>).filter(
    (req) => now - req.timestamp < RATE_LIMIT_WINDOW,
  );

  if (recentRequests.length >= RATE_LIMIT_COUNT) {
          return false;
  }

  recentRequests.push({ timestamp: now });
  await userRateLimitRef.update({ requests: recentRequests });

  return true;
}

// Cache service functions for Firebase environment
const cacheService = {
  // ✅ CACHING SERVICE - Generate content hash for caching
  generateContentHash(content: string | Array<unknown>, writingGoals?: WritingGoals, contextType: 'full' | 'contextWindow' = 'full'): string {
    const hashData = {
      content: Array.isArray(content) ? content : content,
      writingGoals: writingGoals || {},
      contextType,
      // Add timestamp component to ensure cache freshness
      version: 'v2.1'
    };
    
    const hashString = JSON.stringify(hashData);
    return this.simpleHash(hashString);
  },

  // ✅ Enhanced content hash that includes accepted suggestions context
  generateContentHashWithHistory(content: string, writingGoals?: WritingGoals, acceptedSuggestions: Array<{ originalText: string; suggestedText: string; type: string }> = [], contextType: 'full' | 'contextWindow' = 'full'): string {
    const hashData = {
      content: content,
      writingGoals: writingGoals || {},
      contextType,
      // Include accepted suggestions to prevent re-suggesting same content
      acceptedSuggestionsHash: acceptedSuggestions.length > 0 ? 
        this.simpleHash(JSON.stringify(acceptedSuggestions.map(s => ({ 
          originalText: s.originalText, 
          suggestedText: s.suggestedText, 
          type: s.type 
        })))) : 'none',
      version: 'v2.1'
    };
    
    const hashString = JSON.stringify(hashData);
    return this.simpleHash(hashString);
  },

  async getCachedAnalysis(contentHash: string, userId: string): Promise<{ analysis: unknown; metadata: { tokenCount: number; timestamp: number; [k: string]: unknown } } | null> {
    try {
      const cacheRef = db.collection('analysisCache').doc(`${userId}_${contentHash}`);
      const cacheDoc = await cacheRef.get();
      
      if (!cacheDoc.exists) {
        logger.info('🔍 Cache miss: Entry not found');
        return null;
      }
      
      const cacheData = cacheDoc.data() as { expiresAt: { toDate: () => Date }; createdAt: { toDate: () => Date }; accessCount: number; metadata: { tokenCount: number; timestamp: number; [k: string]: unknown } } | undefined;
      if (!cacheData) return null;
      
      const now = new Date();
      
      // Check if cache entry has expired
      if (cacheData.expiresAt.toDate() < now) {
        logger.info('⏰ Cache miss: Entry expired, cleaning up');
        await cacheRef.delete();
        return null;
      }
      
      // Update access statistics
      await cacheRef.update({
        lastAccessedAt: FieldValue.serverTimestamp(),
        accessCount: cacheData.accessCount + 1
      });
      
      logger.info('✅ Cache hit:', {
        contentHash: contentHash.substring(0, 8) + '...',
        accessCount: cacheData.accessCount + 1,
        age: Math.round((now.getTime() - cacheData.createdAt.toDate().getTime()) / (1000 * 60)) + 'min',
        tokenCount: cacheData.metadata.tokenCount
      });
      
      return {
        analysis: cacheData.analysis,
        metadata: {
          ...cacheData.metadata,
          cacheHit: true,
          accessCount: cacheData.accessCount + 1,
          cacheAge: now.getTime() - cacheData.createdAt.toDate().getTime()
        }
      };
      
    } catch (error) {
      logger.error('❌ Error checking cache:', error);
      return null;
    }
  },

  async setCachedAnalysis(
    contentHash: string,
    userId: string,
    analysis: unknown,
    metadata: {
      documentId?: string;
      contextType: 'full' | 'contextWindow';
      tokenCount: number;
      paragraphCount: number;
      writingGoalsHash?: string;
    }
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours TTL
      
      const cacheEntry = {
        id: `${userId}_${contentHash}`,
        contentHash,
        analysis,
        metadata: {
          ...metadata,
          userId
        },
        createdAt: FieldValue.serverTimestamp(),
        lastAccessedAt: FieldValue.serverTimestamp(),
        accessCount: 0,
        expiresAt: FieldValue.serverTimestamp() // Will be updated with proper expiry
      };
      
      const cacheRef = db.collection('analysisCache').doc(cacheEntry.id as string);
      await cacheRef.set(cacheEntry);
      
      // Update with proper expiry time
      await cacheRef.update({
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      
      logger.info('💾 Cached analysis:', {
        contentHash: contentHash.substring(0, 8) + '...',
        contextType: metadata.contextType,
        tokenCount: metadata.tokenCount,
        expiresIn: '24h'
      });
      
    } catch (error) {
      logger.error('❌ Error setting cache:', error);
      // Don't throw - caching failures shouldn't break the main functionality
    }
  },

  simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
};

// Main function to analyze content for suggestions
export const analyzeSuggestions = onCall(commonOptions, async (request) => {
  console.log('🔍 [Firebase] analyzeSuggestions called with request data keys:', Object.keys(request.data));
  
  const startTime = Date.now();
  const responseMetadata = {
    cached: false,
    tokenCount: 0,
    processingTime: 0,
    cacheKey: '',
    analysisType: 'unknown'
  };

  try {
    const { content, documentId, userId, writingGoals, contextWindow, analysisType = 'full', timestamp, bypassCache = false } = request.data;
    
    if (!content || !userId) {
      throw new Error('Missing required parameters: content and userId are required');
    }

    console.log('🔍 [Firebase] Processing analysis request:', {
      contentLength: content.length,
      documentId: documentId || 'not provided',
      userId: userId,
      analysisType,
      hasWritingGoals: !!writingGoals,
      hasContextWindow: !!contextWindow,
      timestamp
    });

    // Rate limiting
    await checkRateLimit(userId);
    
    // Determine content to analyze
    const contentToAnalyze = contextWindow || content;
    responseMetadata.analysisType = contextWindow ? 'differential' : analysisType;
    
    // 🔧 NEW: Fetch accepted suggestions to prevent duplicates
    let acceptedSuggestions: Array<{ originalText: string; suggestedText: string; type: string }> = [];
    if (documentId) {
      try {
        console.log('📋 [Firebase] Fetching accepted suggestions for duplicate prevention');
        const acceptedQuery = db
          .collection('suggestions')
          .where('documentId', '==', documentId)
          .where('userId', '==', userId)
          .where('status', '==', 'accepted')
          .orderBy('updatedAt', 'desc')
          .limit(5); // Last 5 accepted suggestions
        
        const acceptedSnapshot = await acceptedQuery.get();
        acceptedSuggestions = acceptedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Array<{ originalText: string; suggestedText: string; type: string }>;
        
        console.log(`📋 [Firebase] Found ${acceptedSuggestions.length} accepted suggestions for duplicate filtering`);
        
        // Log recent accepted suggestions for debugging
        if (acceptedSuggestions.length > 0) {
          console.log('📋 [Firebase] Recent accepted suggestions:', 
            acceptedSuggestions.slice(0, 3).map(s => ({
              originalText: s.originalText,
              suggestedText: s.suggestedText,
              type: s.type
            }))
          );
        }
      } catch (error) {
        console.warn('⚠️ [Firebase] Failed to fetch accepted suggestions:', error);
        // Continue without accepted suggestions filter
      }
    }

    // Generate cache key with accepted suggestions context
    const cacheKey = cacheService.generateContentHashWithHistory(
      Array.isArray(contentToAnalyze) ? JSON.stringify(contentToAnalyze) : contentToAnalyze, 
      writingGoals,
      acceptedSuggestions,
      contextWindow ? 'contextWindow' : 'full'
    );
    responseMetadata.cacheKey = cacheKey;
    
    console.log('🔍 [Firebase] Generated cache key:', cacheKey);

    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cacheService.getCachedAnalysis(cacheKey, userId);
      if (cached) {
        const cacheAge = Date.now() - cached.metadata.timestamp;
        console.log(`💾 [Firebase] Cache hit! Age: ${Math.round(cacheAge / 1000)}s`);
        
        responseMetadata.cached = true;
        responseMetadata.processingTime = Date.now() - startTime;
        responseMetadata.tokenCount = cached.metadata.tokenCount || 0;
        
        return {
          metadata: responseMetadata,
          message: `${acceptedSuggestions.length} suggestions are being processed.`,
        };
      }
    }
    console.log('🔍 [Firebase] Cache miss - proceeding with AI analysis');

    // Prepare system prompt and user prompt
    const systemPrompt = generateSystemPrompt(writingGoals || { academicLevel: 'undergrad' });
    let userPrompt: string;
    
    // Handle context window vs full content
    if (contextWindow && Array.isArray(contextWindow)) {
      console.log('🔍 [Firebase] Using context window for differential analysis');
      const contextText = contextWindow
        .map(w => `[${w.index}${w.isChanged ? ' CHANGED' : ''}] ${w.text}`)
        .join('\n\n');
      
      userPrompt = `Analyze the following content sections. Focus on the CHANGED sections for new suggestions:

${contextText}

${acceptedSuggestions.length > 0 ? `
🚫 CRITICAL DUPLICATE PREVENTION: The following suggestions have already been accepted and applied. DO NOT suggest these exact changes or similar variations:
${acceptedSuggestions.map(s => `- "${String(s.originalText).slice(0, 40)}..."`).join('\n')}

DUPLICATE PREVENTION RULES:
- If you see text that matches any "suggestedText" above, DO NOT suggest changes to it
- If the current text already includes the fixes from accepted suggestions, DO NOT re-suggest them
- Focus on NEW issues that haven't been addressed yet
- When text shows "I don't know." (with apostrophe and period), do NOT suggest adding apostrophe or period again
` : ''}

Return suggestions as JSON with the required format.`;
    } else {
      console.log('🔍 [Firebase] Using full content for analysis');
      userPrompt = `Please analyze the following text and provide suggestions for improvement:

${contentToAnalyze}

${acceptedSuggestions.length > 0 ? `
🚫 CRITICAL DUPLICATE PREVENTION: The following suggestions have already been accepted and applied. DO NOT suggest these exact changes or similar variations:
${acceptedSuggestions.map(s => `- "${String(s.originalText).slice(0, 40)}..."`).join('\n')}

DUPLICATE PREVENTION RULES:
- If you see text that matches any "suggestedText" above, DO NOT suggest changes to it
- If the current text already includes the fixes from accepted suggestions, DO NOT re-suggest them
- Focus on NEW issues that haven't been addressed yet
- When text shows "I don't know." (with apostrophe and period), do NOT suggest adding apostrophe or period again
` : ''}

Return suggestions as JSON with the required format.`;
    }

    console.log('🤖 [Firebase] Calling OpenAI API...');
    // Use lower temperature for deterministic, grammar-focused suggestions
    const response = await getOpenAICompletion(systemPrompt, userPrompt, 0.1);
    
    // Calculate token count (rough estimate)
    const tokenCount = Math.ceil((systemPrompt.length + userPrompt.length + JSON.stringify(response).length) / 4);
    responseMetadata.tokenCount = tokenCount;
    
    console.log('🤖 [Firebase] OpenAI response received, parsing suggestions...');
    
    const suggestions = response.suggestions || [];
    console.log(`✅ [Firebase] Analysis complete: ${suggestions.length} suggestions generated`);

    // Write new suggestions to Firestore - SIMPLIFIED APPROACH
    if (documentId && userId && suggestions.length > 0) {
      console.log(`🔍 [Firebase] Writing ${suggestions.length} suggestions to Firestore`);
      console.log('🔍 [Firebase] First suggestion sample:', JSON.stringify(suggestions[0], null, 2));
      
      const batch = db.batch();
      let successCount = 0;
      
      suggestions.forEach((suggestion: Record<string, unknown>, index: number) => {
        try {
          const suggestionRef = db.collection("suggestions").doc();
          
          // Minimal data cleaning - accept almost everything
          const cleanSuggestion = {
            id: suggestionRef.id,
            documentId,
            userId,
            status: "pending",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            
            // Core suggestion data - use what AI provides or sensible defaults
            originalText: (suggestion.originalText as string) || `Text ${index}`,
            suggestedText: (suggestion.suggestedText as string) || `Improved text ${index}`,
            type: (suggestion.type as string) || 'grammar',
            category: (suggestion.category as string) || 'general',
            severity: (suggestion.severity as string) || 'medium',
            confidence: (suggestion.confidence as number) || 0.85,
            explanation: (suggestion.explanation as string) || 'AI suggested improvement',
            grammarRule: (suggestion.grammarRule as string | null) || null,
            
            // Index handling - calculate from content if missing
            startIndex: (suggestion.startIndex as number) || 0,
            endIndex: (suggestion.endIndex as number) || ((suggestion.originalText as string | undefined)?.length ?? 1),
          };
          
          batch.set(suggestionRef, cleanSuggestion);
          successCount++;
          
          console.log(`✅ [Firebase] Prepared suggestion ${index}: "${cleanSuggestion.originalText}" -> "${cleanSuggestion.suggestedText}"`);
          
        } catch (error) {
          console.error(`❌ [Firebase] Error preparing suggestion ${index}:`, error);
        }
      });
      
      try {
        await batch.commit();
        console.log(`✅ [Firebase] Successfully wrote ${successCount} suggestions to Firestore`);
        logger.info(`[Firebase] Wrote ${successCount} suggestions to Firestore for document ${documentId}`);
      } catch (error) {
        console.error('❌ [Firebase] Error writing suggestions to Firestore:', error);
        throw error;
      }
    } else {
      console.log('🔍 [Firebase] No suggestions to write:', {
        hasDocumentId: !!documentId,
        hasUserId: !!userId,
        suggestionsLength: suggestions.length
      });
    }

    // Cache the result unless bypassed or suggestions empty
    if (!bypassCache && suggestions.length > 0) {
      await cacheService.setCachedAnalysis(cacheKey, userId, { suggestions }, {
        documentId,
        contextType: contextWindow ? 'contextWindow' : 'full',
        tokenCount,
        paragraphCount: Array.isArray(contextWindow) ? contextWindow.length : content.split('\n\n').length,
        writingGoalsHash: writingGoals ? cacheService.simpleHash(JSON.stringify(writingGoals)) : 'none'
      });
    }

    responseMetadata.processingTime = Date.now() - startTime;
    
    console.log('📊 [Firebase] Analysis metadata:', responseMetadata);
    
    return {
      metadata: responseMetadata,
      message: `${suggestions.length} suggestions are being processed.`,
    };

  } catch (error) {
    responseMetadata.processingTime = Date.now() - startTime;
    console.error('❌ [Firebase] analyzeSuggestions error:', error);
    
    if (error instanceof Error) {
      throw new Error(`Analysis failed: ${error.message}`);
    } else {
      throw new Error('Analysis failed: Unknown error occurred');
    }
  }
});


/**
 * ===================================================================
 *                         STRUCTURE ANALYSIS FUNCTIONS
 * ===================================================================
 */
export const analyzeEssayStructure = onCall(corsOptions, async (request) => {
  const startTime = Date.now();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { content, documentId, userId, assignmentType, academicLevel } = request.data;
  if (!content || !documentId || !userId || !assignmentType || !academicLevel) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  if (request.auth.uid !== userId) {
    throw new HttpsError("permission-denied", "Unauthorized action.");
  }
  
  // Use a mock function for now to avoid high costs during development
  const mockResponse = await generateMockStructureAnalysis(
    content,
          documentId,
          userId,
    startTime,
          assignmentType,
    academicLevel
  );

  const { structure, structureSuggestions } = mockResponse;

  // Save the structure analysis to Firestore
  const structureRef = db.collection("essayStructures").doc();
  await structureRef.set({
    ...structure,
    analysisId: structureRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
  });

  // Save structure-related suggestions to Firestore
  if (structureSuggestions && structureSuggestions.length > 0) {
    const batch = db.batch();
    structureSuggestions.forEach((suggestion: { [k: string]: unknown }) => {
      const suggestionRef = db.collection("suggestions").doc();
      batch.set(suggestionRef, {
        ...suggestion,
        id: suggestionRef.id,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const processingTime = Date.now() - startTime;
  return {
    structure: { ...structure, analysisId: structureRef.id },
    structureSuggestions,
    analysisId: structureRef.id,
    processingTime,
  };
});

// Mock function to simulate structure analysis
async function generateMockStructureAnalysis(
  content: string, 
  documentId: string, 
  userId: string, 
  startTime: number,
  assignmentType: string,
  academicLevel: string
) {
  const sections: Array<{
    id: string;
    type: 'introduction' | 'thesis' | 'body-paragraph' | 'conclusion' | 'transition';
    startIndex: number;
    endIndex: number;
    text: string;
    confidence: number;
    metadata: { paragraphNumber: number; transitionQuality: 'weak' | 'moderate' | 'strong' };
    suggestions?: string[];
  }> = [];
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 20);
  let currentIndex = 0;
  let prevParagraph: string | null = null;
  let thesisFound = false;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const startIndex = content.indexOf(paragraph, currentIndex);
    const endIndex = startIndex + paragraph.length;
    currentIndex = endIndex;
    
    // --- Detect thesis presence ------------------------------------------------
    const thesisKeywords = [
      "this essay will",
      "this essay argues",
      "this essay aims",
      "in this essay",
      "i will argue",
      "i argue that",
      "we argue that",
      "the purpose of this paper",
      "this paper argues",
      "this paper will",
      "my thesis is",
      "our thesis is that",
      "the thesis of this essay",
      "the thesis of this paper",
      "the main objective of this essay",
      "overall, this essay"
    ];

    const paragraphLower = paragraph.toLowerCase();
    const containsThesisKeyword = thesisKeywords.some(k => paragraphLower.includes(k));

    const thesisPattern = /(should|must|needs to|ought to|have to|will|is|are)\s+.*\b(because|since|as|therefore)\b/i;

    const isThesisCandidate = containsThesisKeyword || thesisPattern.test(paragraph);

    // --- Determine section types for this paragraph ---------------------------
    const paragraphTypes: ("introduction" | "thesis" | "body-paragraph" | "conclusion" | "transition")[] = [];

    if (i === 0) {
      paragraphTypes.push("introduction");
    } else if (i === paragraphs.length - 1 && paragraphs.length > 1) {
      paragraphTypes.push("conclusion");
    } else {
      paragraphTypes.push("body-paragraph");
    }

    if (isThesisCandidate && !thesisFound) {
      paragraphTypes.push("thesis");
      thesisFound = true;
    }

    // --- Generate sections for each type --------------------------------------
    const transitionQuality = analyzeTransitionQuality(paragraph, prevParagraph, academicLevel);

    paragraphTypes.forEach((typeLabel) => {
      let thesisSentence: string | undefined;
      let sectionStart = startIndex;
      let sectionEnd = endIndex;

      // If this is a thesis section that shares the paragraph with the introduction,
      // narrow the range to just the thesis sentence for more precise highlighting.
      if (typeLabel === "thesis") {
        const sentences = paragraph.match(/[^.!?]+[.!?]?/g) || [paragraph];
        const foundSentenceCandidate = sentences.find((sentence) => {
          const sentenceLower = sentence.toLowerCase();
          return thesisKeywords.some(k => sentenceLower.includes(k)) || thesisPattern.test(sentence);
        });
        thesisSentence = foundSentenceCandidate;
        if (!thesisSentence) {
          // fallback: choose the longest sentence (often thesis)
          thesisSentence = sentences.reduce((a, b) => (b.length > a.length ? b : a), sentences[0]);
        }
        const relativeStart = paragraph.indexOf(thesisSentence!);
        sectionStart = startIndex + relativeStart;
        sectionEnd = sectionStart + thesisSentence!.length;
      }

      const sectionText = (typeLabel === "thesis" && thesisSentence) ? thesisSentence.trim() : paragraph;

      sections.push({
        id: `sec_${i}_${typeLabel}`,
        type: typeLabel,
        startIndex: sectionStart,
        endIndex: sectionEnd,
        text: sectionText,
        confidence: Math.random() * 0.2 + 0.8,
        metadata: {
          paragraphNumber: i + 1,
          transitionQuality,
        },
        suggestions: generateTransitionSuggestions(transitionQuality, academicLevel, typeLabel),
      });
    });

    prevParagraph = paragraph;
  }
  
  const hasIntroduction = sections.some(s => s.type === "introduction");
  const hasThesis = thesisFound;
  const hasConclusion = sections.some(s => s.type === "conclusion");
  const bodyParagraphCount = sections.filter(s => s.type === "body-paragraph").length;
  
  const missingElements = [];
  if (!hasIntroduction) missingElements.push("Introduction");
  if (!hasThesis && assignmentType === 'essay') missingElements.push("Thesis Statement");
  if (!hasConclusion) missingElements.push("Conclusion");

  const structure = {
      documentId,
      userId,
    sections,
    overallStructure: {
      hasIntroduction,
      hasThesis,
      bodyParagraphCount,
      hasConclusion,
      structureScore: (hasIntroduction && hasConclusion ? 0.5 : 0.2) + (bodyParagraphCount > 0 ? 0.5 : 0.2),
      missingElements,
      weakElements: sections.filter(s => s.metadata.transitionQuality === 'weak'),
    },
  };
  
  const structureSuggestions = sections.flatMap((section: { text: string; startIndex: number; endIndex: number; suggestions?: string[] }, index: number) => {
    return (section.suggestions as string[] | undefined)?.map((explanation: string, sugIndex: number) => ({
      id: `sug_struct_${index}_${sugIndex}`,
        documentId,
        userId,
      type: "structure",
      category: "improvement",
      severity: "medium",
      originalText: section.text.substring(0, 50) + "...",
      suggestedText: section.text.substring(0, 50) + "...",
      explanation,
      startIndex: section.startIndex,
      endIndex: section.endIndex,
      confidence: 0.8 // Ensure structure suggestions have confidence
    })) || [];
  });
  
  return { structure, structureSuggestions };
}

function analyzeTransitionQuality(paragraph: string, prevParagraph: string | null, academicLevel: string): 'weak' | 'moderate' | 'strong' {
  const weakTransitions = ["First,", "Second,", "Also,", "Next,"];
  const moderateTransitions = ["In addition,", "Furthermore,", "Moreover,", "However,"];
  const strongTransitions = ["Consequently,", "Nevertheless,", "On the other hand,"];
  
  const text = paragraph.toLowerCase();
  
  if (strongTransitions.some(t => text.startsWith(t.toLowerCase()))) return 'strong';
  if (moderateTransitions.some(t => text.startsWith(t.toLowerCase()))) return 'moderate';
  if (weakTransitions.some(t => text.startsWith(t.toLowerCase()))) return 'weak';
  
  if (prevParagraph && academicLevel !== 'middle-school') {
    const lastSentence = prevParagraph.trim().split(/[.!?]/).filter(s => s.trim()).pop() || "";
    const firstWord = text.split(' ')[0];
    if (lastSentence.includes(firstWord.replace(/,/g, ''))) return 'moderate'; // Simple repetition bridge
  }
  
        return 'weak';
}

function generateTransitionSuggestions(transitionQuality: string, academicLevel: string, sectionType: string): string[] {
  const suggestions = [];
  if (transitionQuality === 'weak' && sectionType === 'body-paragraph') {
    if (academicLevel === 'middle-school') {
      suggestions.push("Try starting this paragraph with a word like 'Next,' or 'Also,' to connect it to the previous one.");
    } else {
      suggestions.push("The transition to this paragraph could be stronger. Consider using a phrase like 'Furthermore,' or 'In contrast,' to show how this idea relates to the previous one.");
    }
  }
    return suggestions;
}


/**
 * ===================================================================
 *                         RUBRIC FUNCTIONS
 * ===================================================================
 */

// Function to parse raw rubric text using AI
export const parseAssignmentRubric = onCall(commonOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { rawText, documentId, userId, title } = request.data;
  if (!rawText || !documentId || !userId) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (request.auth.uid !== userId) {
    throw new HttpsError("permission-denied", "Unauthorized action.");
  }

  try {
    const gptResponse = await getOpenAICompletion(parseRubricPrompt, rawText);
    
    // Add missing fields to the response
    const parsedRubric = {
      ...gptResponse,
      documentId,
      userId,
      title: title || 'Parsed Rubric',
      rawText,
      isStructured: false,
    };
    
    return parsedRubric;
  } catch (error) {
    logger.error("Error in parseAssignmentRubric:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to parse rubric.");
  }
});

// Function to analyze content against a rubric
export const analyzeWithRubric = onCall(commonOptions, async (request) => {
  const startTime = Date.now();
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { content, documentId, userId, rubric, academicLevel } = request.data;
  logger.info(`analyzeWithRubric called with academicLevel: ${academicLevel}`);
  if (!content || !documentId || !userId || !rubric || !academicLevel) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (request.auth.uid !== userId) {
    throw new HttpsError("permission-denied", "Unauthorized action.");
  }

  try {
    const userPrompt = `
      **Rubric:**
      ${JSON.stringify(rubric)}

      ---

      **User Text:**
      ${content}
    `;
    const systemPrompt = generateAnalyzeWithRubricPrompt(academicLevel);
    const gptResponse = await getOpenAICompletion(systemPrompt, userPrompt);
    
    const feedback = {
      ...gptResponse,
    documentId,
    userId,
      rubricId: rubric.id,
      analysisId: `rubric_analysis_${Date.now()}`,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

    // Save feedback to Firestore
    const feedbackRef = db.collection("rubricFeedback").doc();
    await feedbackRef.set(feedback);

  const processingTime = Date.now() - startTime;
  return {
      feedback: { ...feedback, id: feedbackRef.id },
      suggestions: [], // Placeholder for future rubric-generated suggestions
      analysisId: feedback.analysisId,
    processingTime,
    };
  } catch (error) {
    logger.error("Error in analyzeWithRubric:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to analyze with rubric.");
  }
});


/**
 * ===================================================================
 *                    FUNCTION WARMING SERVICE
 * ===================================================================
 */

// Health check endpoint to keep functions warm - HTTP function for Cloud Scheduler
export const pingHealth = onRequest(corsOptions, async (req: Request, res: Response) => {
  const timestamp = Date.now();
  const response = {
    status: 'warm',
    timestamp,
    message: 'Function is ready',
    version: '1.0.0',
    method: req.method
  };
  res.json(response);
});

// Specific health checks for each main function to keep them warm
export const pingAnalyzeSuggestions = onRequest(corsOptions, async (req: Request, res: Response) => {
  const timestamp = Date.now();
  const response = {
    function: 'analyzeSuggestions',
    status: 'warm',
    timestamp,
    ready: true,
    method: req.method
  };
  res.json(response);
});

export const pingAnalyzeEssayStructure = onRequest(corsOptions, async (req: Request, res: Response) => {
  const timestamp = Date.now();
  const response = {
    function: 'analyzeEssayStructure',
    status: 'warm',
    timestamp,
    ready: true,
    method: req.method
  };
  res.json(response);
});

export const pingParseAssignmentRubric = onRequest(corsOptions, async (req: Request, res: Response) => {
  const timestamp = Date.now();
  const response = {
    function: 'parseAssignmentRubric',
    status: 'warm',
    timestamp,
    ready: true,
    method: req.method
  };
  res.json(response);
});

export const pingAnalyzeWithRubric = onRequest(corsOptions, async (req: Request, res: Response) => {
  const timestamp = Date.now();
  const response = {
    function: 'analyzeWithRubric',
    status: 'warm',
    timestamp,
    ready: true,
    method: req.method
  };
  res.json(response);
});

// Comprehensive warmup function that pings all main functions
export const pingAllFunctions = onRequest(corsOptions, async (req: Request, res: Response) => {
  const timestamp = Date.now();
  const functions = [
    'analyzeSuggestions',
    'analyzeEssayStructure', 
    'parseAssignmentRubric',
    'analyzeWithRubric'
  ];
  
  const response = {
    status: 'all-functions-warm',
    timestamp,
    functions,
    message: 'All main functions are ready and warm',
    count: functions.length,
    method: req.method
  };
  res.json(response);
});

/**
 * ===================================================================
 *                         MAINTENANCE FUNCTIONS
 * ===================================================================
 */

// Scheduled function to clean up old data
export const cleanupOldData = onSchedule("every 24 hours", async () => {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Clean up old suggestions
  const oldSuggestionsQuery = db
    .collection("suggestions")
    .where("createdAt", "<", thirtyDaysAgo);
  const oldSuggestionsSnapshot = await oldSuggestionsQuery.get();
  const batch = db.batch();
  oldSuggestionsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  logger.log(`Deleted ${oldSuggestionsSnapshot.size} old suggestions.`);

  // Clean up old rate limit entries
  const rateLimitsSnapshot = await db.collection("rateLimits").get();
  const rateLimitBatch = db.batch();
  rateLimitsSnapshot.forEach((doc) => {
    const data = doc.data() as { requests?: Array<{ timestamp: number }> };
    const recentRequests = (data.requests || []).filter(
      (req) => now - req.timestamp < RATE_LIMIT_WINDOW,
    );
    rateLimitBatch.update(doc.ref, { requests: recentRequests });
  });
  await rateLimitBatch.commit();
  
  logger.log("Cleaned up rate limit entries.");
});
