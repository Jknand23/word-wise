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
  analysisType?: 'full' | 'incremental';
  previouslyModifiedAreas?: ModifiedArea[];
  writingGoals?: WritingGoalsConfig;
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
