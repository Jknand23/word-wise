export interface Suggestion {
  id: string;
  documentId: string;
  type: 'spelling' | 'clarity' | 'engagement' | 'grammar' | 'tone' | 'structure' | 'depth' | 'vocabulary';
  category: 'error' | 'improvement' | 'enhancement';
  severity: 'low' | 'medium' | 'high';
  originalText: string;
  suggestedText: string;
  explanation: string;
  grammarRule?: string;
  educationalExplanation?: string;
  example?: string;
  startIndex: number;
  endIndex: number;
  confidence: number; // 0-1
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  parentSuggestionId?: string;
  iterationCount?: number;
  modificationHistory?: string[];
  academicLevel?: 'middle-school' | 'high-school' | 'undergrad';
  assignmentType?: 'essay' | 'reflection' | 'report';
}

// New interfaces for essay structure analysis
export interface EssaySection {
  id: string;
  type: 'introduction' | 'thesis' | 'body-paragraph' | 'conclusion' | 'transition';
  startIndex: number;
  endIndex: number;
  text: string;
  confidence: number; // 0-1
  isWeak?: boolean;
  isOptional?: boolean;
  suggestions?: string[];
  metadata?: {
    paragraphNumber?: number;
    topicSentence?: {
      startIndex: number;
      endIndex: number;
      text: string;
    };
    evidenceCount?: number;
    transitionQuality?: 'weak' | 'moderate' | 'strong';
  };
}

export interface EssayStructure {
  documentId: string;
  userId: string;
  sections: EssaySection[];
  overallStructure: {
    hasIntroduction: boolean;
    hasThesis: boolean;
    bodyParagraphCount: number;
    hasConclusion: boolean;
    structureScore: number; // 0-1
    missingElements: string[];
    weakElements: EssaySection[];
  };
  analysisId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StructureAnalysisRequest {
  content: string;
  documentId: string;
  userId: string;
  assignmentType?: 'essay' | 'reflection' | 'report';
  academicLevel?: 'middle-school' | 'high-school' | 'undergrad';
}

export interface StructureAnalysisResponse {
  structure: EssayStructure;
  structureSuggestions: Suggestion[];
  analysisId: string;
  processingTime: number;
}

export interface WritingGoalsConfig {
  academicLevel: 'middle-school' | 'high-school' | 'undergrad';
  assignmentType: 'essay' | 'reflection' | 'report';
  customInstructions?: string;
  grammarStrictness: 'lenient' | 'moderate' | 'strict';
  vocabularyLevel: 'simple' | 'intermediate' | 'advanced';
  toneRecommendation: string;
}

export interface SuggestionRequest {
  documentId: string;
  content: string;
  userId: string;
  analysisType?: 'full' | 'incremental' | 'differential';
  previousContent?: string; // ✅ DIFFERENTIAL ANALYSIS - Previous content for change tracking
  previouslyModifiedAreas?: ModifiedArea[];
  writingGoals?: WritingGoalsConfig;
  paragraphTags?: ParagraphTag[]; // Include paragraph tags to exclude "Done" paragraphs
  bypassCache?: boolean; // Skip cache and force fresh analysis
}

export interface SuggestionResponse {
  suggestions: Suggestion[];
  analysisId: string;
  processingTime: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  optimizationMetadata?: {
    usedContextWindow: boolean;
    usedCache?: boolean;
    cacheHit?: boolean;
    tokenSavings: {
      originalTokens: number;
      optimizedTokens: number;
      savings: number;
    } | null;
    contextWindowSize: number;
    cacheMetadata?: {
      cacheHit: boolean;
      accessCount: number;
      cacheAge: number;
    };
  };
}

export interface GPTAnalysisRequest {
  content: string;
  previousSuggestions?: Suggestion[];
  focusAreas?: ('spelling' | 'clarity' | 'engagement' | 'grammar')[];
  previouslyModifiedAreas?: ModifiedArea[];
}

export interface GPTAnalysisResponse {
  suggestions: Omit<Suggestion, 'id' | 'documentId' | 'status' | 'createdAt' | 'updatedAt' | 'userId'>[];
  confidence: number;
  summary: string;
}

export interface ModifiedArea {
  startIndex: number;
  endIndex: number;
  type: 'clarity' | 'engagement';
  originalText: string;
  modifiedText: string;
  iterationCount: number;
  lastModified: Date;
  suggestionIds: string[];
}

// Rubric-based feedback types
export interface RubricLevel {
  id: string;
  score: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number; // 0-1, how important this criterion is
  levels: RubricLevel[]; // Scoring levels (e.g., Excellent=4, Good=3, Fair=2, Poor=1)
  expectedElements: string[];
  examples?: string[];
  requiredCount?: number; // For things like "minimum 3 citations"
  type: 'count' | 'quality' | 'presence' | 'structure' | 'tone' | 'length';
}

export interface AssignmentRubric {
  id: string;
  documentId: string;
  userId: string;
  title: string;
  rawText?: string;
  isStructured: boolean;
  totalPoints?: number;
  assignmentType: 'essay' | 'reflection' | 'report' | 'research-paper' | 'creative-writing' | 'other';
  criteria: RubricCriterion[];
  extractedRequirements: {
    wordCount?: { min?: number; max?: number };
    citationCount?: { min?: number; style?: 'APA' | 'MLA' | 'Chicago' | 'Harvard' };
    structure?: string[];
    tone?: string;
    format?: string;
    dueDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RubricAnalysisResult {
  criterionId: string;
  score: number; // 0-1, how well the writing meets this criterion
  feedback: string;
  specificIssues: {
    type: 'missing' | 'insufficient' | 'incorrect' | 'needs-improvement';
    description: string;
    location?: { startIndex: number; endIndex: number };
    suggestion?: string;
  }[];
  metExpectations: string[];
  missedExpectations: string[];
}

export interface RubricFeedback {
  id: string;
  documentId: string;
  userId: string;
  rubricId: string;
  overallScore: number; // 0-1
  overallFeedback: string;
  criteriaResults: RubricAnalysisResult[];
  suggestions: Suggestion[]; // Rubric-specific suggestions
  analysisId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RubricAnalysisRequest {
  content: string;
  documentId: string;
  userId: string;
  rubricId: string;
  rubric: AssignmentRubric;
}

export interface RubricAnalysisResponse {
  feedback: RubricFeedback;
  suggestions: Suggestion[];
  analysisId: string;
  processingTime: number;
}

// Paragraph tagging interfaces
export interface ParagraphTag {
  id: string;
  documentId: string;
  userId: string;
  paragraphIndex: number;
  startIndex: number;
  endIndex: number;
  text: string; // The actual paragraph text (for validation)
  tagType: 'needs-review' | 'done';
  note?: string; // Optional user note
  createdAt: Date;
  updatedAt: Date;
}

export interface ParagraphTagData {
  documentId: string;
  userId: string;
  paragraphIndex: number;
  startIndex: number;
  endIndex: number;
  text: string;
  tagType: 'needs-review' | 'done';
  note?: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

export interface TaggingState {
  tags: ParagraphTag[];
  filteredByTag: 'all' | 'needs-review' | 'done' | null;
  isLoading: boolean;
  error: string | null;
}
