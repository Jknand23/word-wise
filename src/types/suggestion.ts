export interface Suggestion {
  id: string;
  documentId: string;
  type: 'spelling' | 'clarity' | 'engagement' | 'grammar';
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
}

export interface SuggestionRequest {
  documentId: string;
  content: string;
  userId: string;
  analysisType?: 'full' | 'incremental';
  previouslyModifiedAreas?: ModifiedArea[];
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
