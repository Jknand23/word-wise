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

// CORS options
const corsOptions = {
  cors: ["http://localhost:5173", "https://wordwise-ai-3a4e1.web.app"],
};

const commonOptions = {
  ...corsOptions,
  secrets: [openaiApiKey],
};

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
- type: 'spelling', 'grammar', 'clarity', 'engagement', 'tone', 'structure', 'depth', or 'vocabulary'
- category: 'error', 'improvement', or 'enhancement'
- severity: 'low', 'medium', or 'high'
- originalText: The exact text to be replaced
- suggestedText: The suggested replacement text
- explanation: A clear, concise explanation of the suggestion
- educationalExplanation: A more detailed explanation of the underlying writing principle
- startIndex: The starting index of the original text in the content
- endIndex: The ending index of the original text in the content

Return the response as a valid JSON object with a 'suggestions' array.
Example for a spelling error:
{
  "suggestions": [
    {
      "type": "spelling",
      "category": "error",
      "severity": "high",
      "originalText": "teh",
      "suggestedText": "the",
      "explanation": "Corrected spelling",
      "educationalExplanation": "The word 'the' is a common article and is spelled T-H-E.",
      "startIndex": 10,
      "endIndex": 13
    }
  ]
}
`;
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
      model: "gpt-4-turbo-preview",
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

    return JSON.parse(responseContent);
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

  const recentRequests = data.requests.filter(
    (req: any) => now - req.timestamp < RATE_LIMIT_WINDOW,
  );

  if (recentRequests.length >= RATE_LIMIT_COUNT) {
          return false;
  }

  recentRequests.push({ timestamp: now });
  await userRateLimitRef.update({ requests: recentRequests });

  return true;
}

// Main function to analyze content for suggestions
export const analyzeSuggestions = onCall(commonOptions, async (request) => {
  const startTime = Date.now();

  // Validate user authentication and data
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const { content, documentId, userId, previouslyModifiedAreas, writingGoals } = request.data;
  if (!content || !documentId || !userId) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required data: content, documentId, or userId.",
    );
  }

  // Verify that the user ID from the request matches the authenticated user
  if (request.auth.uid !== userId) {
    throw new HttpsError(
      "permission-denied",
      "You are not authorized to perform this action.",
    );
  }

  // Check rate limit
  const isWithinRateLimit = await checkRateLimit(userId);
  if (!isWithinRateLimit) {
    throw new HttpsError(
      "resource-exhausted",
      "You have exceeded the rate limit. Please try again later.",
    );
  }

  try {
    const systemPrompt = generateSystemPrompt(writingGoals);
    const userPrompt = `
      Analyze the following text.
      Here are the areas that were recently modified by the user. Be extra careful not to suggest changes to these areas unless you find a clear spelling or grammar error:
      ${JSON.stringify(previouslyModifiedAreas || [])}
      ---
      TEXT TO ANALYZE:
      ${content}
    `;

    const gptResponse = await getOpenAICompletion(systemPrompt, userPrompt);
    const { suggestions = [] } = gptResponse;

    const suggestionsWithIds = suggestions.map((s: any) => ({
      ...s,
      id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        userId,
      status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }));

    // Save suggestions to Firestore
    const batch = db.batch();
    suggestionsWithIds.forEach((suggestion: any) => {
      const suggestionRef = db.collection("suggestions").doc(suggestion.id);
      batch.set(suggestionRef, suggestion);
    });
    await batch.commit();

    const processingTime = Date.now() - startTime;
    return {
      suggestions: suggestionsWithIds,
      analysisId: `analysis_${Date.now()}`,
      processingTime,
    };
  } catch (error) {
    logger.error("Error in analyzeSuggestions:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred.");
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
    structureSuggestions.forEach((suggestion: any) => {
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
  const sections = [];
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 20);
  let currentIndex = 0;
  let prevParagraph: string | null = null;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const startIndex = content.indexOf(paragraph, currentIndex);
    const endIndex = startIndex + paragraph.length;
    currentIndex = endIndex;
    
    let type: "introduction" | "thesis" | "body-paragraph" | "conclusion" | "transition" = "body-paragraph";
    if (i === 0) type = "introduction";
    if (i === paragraphs.length - 1 && paragraphs.length > 1) type = "conclusion";
    
    // Simple thesis detection
    const thesisKeywords = ["this essay will", "i will argue", "the purpose of this paper"];
    if (i === 0 && thesisKeywords.some(k => paragraph.toLowerCase().includes(k))) {
      type = "thesis";
    }

    const transitionQuality = analyzeTransitionQuality(paragraph, prevParagraph, academicLevel);
    
    sections.push({
      id: `sec_${i}`,
      type,
      startIndex,
      endIndex,
      text: paragraph,
      confidence: Math.random() * 0.2 + 0.8,
      metadata: {
        paragraphNumber: i + 1,
        transitionQuality,
      },
      suggestions: generateTransitionSuggestions(transitionQuality, academicLevel, type),
    });
    prevParagraph = paragraph;
  }
  
  const hasIntroduction = sections.some(s => s.type === "introduction");
  const hasThesis = sections.some(s => s.type === "thesis");
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
  
  const structureSuggestions = sections.flatMap((section, index) => {
    return section.suggestions?.map((explanation, sugIndex) => ({
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
      endIndex: section.endIndex
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
    const data = doc.data();
    const recentRequests = data.requests.filter(
      (req: any) => now - req.timestamp < RATE_LIMIT_WINDOW,
    );
    rateLimitBatch.update(doc.ref, { requests: recentRequests });
  });
  await rateLimitBatch.commit();
  
  logger.log("Cleaned up rate limit entries.");
});
