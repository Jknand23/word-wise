import { collection, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import type { Suggestion, SuggestionRequest, SuggestionResponse, StructureAnalysisRequest, StructureAnalysisResponse, EssayStructure } from '../types/suggestion';
import { modificationTrackingService } from './modificationTrackingService';
import { paragraphTagService } from './paragraphTagService';
import { useWritingGoalsStore } from '../store/writingGoalsStore';
import { contentAnalysisService } from './contentAnalysisService';
import { cacheService } from './cacheService';
import type { OptimizedAnalysisRequest } from './contentAnalysisService';
import { differentialAnalysisMonitor } from './differentialAnalysisMonitor';
import { logger } from '../utils/logger';

// ✅ DIFFERENTIAL ANALYSIS - Extended request type for differential analysis
interface DifferentialAnalysisRequest extends SuggestionRequest {
  analysisType?: 'full' | 'differential' | 'incremental';
  previousContent?: string;
  optimizedAnalysis?: OptimizedAnalysisRequest;
}

// ✅ DIFFERENTIAL ANALYSIS - Enhanced response type with differential metadata
interface DifferentialAnalysisResponse extends SuggestionResponse {
  differentialMetadata?: {
    isDifferential: boolean;
    changedParagraphs: number;
    mergedSuggestions: number;
    skippedAnalysis: boolean;
  };
}

export const suggestionService = {
  // Store previous content for context window management
  _previousContent: new Map<string, string>(),
  // Track the number of consecutive differential analyses per document
  _differentialCounter: new Map<string, number>(),

  // ✅ DIFFERENTIAL ANALYSIS - Enhanced suggestion request with differential analysis support
  async requestSuggestions(request: DifferentialAnalysisRequest): Promise<DifferentialAnalysisResponse> {
    try {
      logger.differential('Request received', {
        documentId: request.documentId,
        analysisType: request.analysisType,
        contentLength: request.content.length,
        hasPreviousContent: !!request.previousContent
      });

      // Check if we should use differential analysis
      const shouldUseDifferential = await this.shouldUseDifferentialAnalysis(request);
      
      logger.differential('Decision factors', {
        shouldUseDifferential,
        analysisType: request.analysisType,
        finalDecision: shouldUseDifferential && request.analysisType !== 'full' ? 'differential' : 'full'
      });
      
      if (shouldUseDifferential && request.analysisType !== 'full') {
        logger.differential('Using differential analysis approach');
        return await this.requestDifferentialAnalysis(request);
      } else {
        logger.differential('Using full document analysis');
        return await this.requestFullAnalysis(request);
      }
    } catch (error) {
      logger.error('Error in requestSuggestions:', error);
      throw error;
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Check if differential analysis should be used
  async shouldUseDifferentialAnalysis(request: DifferentialAnalysisRequest): Promise<boolean> {
    logger.differential('Checking differential analysis eligibility', {
      documentId: request.documentId,
      analysisType: request.analysisType
    });

    // Skip differential analysis for new documents or when explicitly requested full analysis
    if (!request.documentId || request.documentId === 'new' || request.analysisType === 'full') {
      logger.differential('Skipping - new document or full analysis requested');
      // Reset counter for safety
      if (request.documentId) {
        this._differentialCounter.set(request.documentId, 0);
      }
      return false;
    }

    // Check if there are unanalyzed changes
    const hasUnanalyzedChanges = await modificationTrackingService.hasUnanalyzedChanges(
      request.documentId,
      request.userId
    );

    logger.differential('Unanalyzed changes found:', hasUnanalyzedChanges);

    if (!hasUnanalyzedChanges) {
      // No changes ⇒ no differential needed; reset counter
      this._differentialCounter.set(request.documentId, 0);
      return false;
    }

    // Increment counter and decide
    const current = this._differentialCounter.get(request.documentId) || 0;
    const updated = current + 1;
    this._differentialCounter.set(request.documentId, updated);

    // Force full analysis after every 10 differential runs to catch missed errors
    if (updated >= 10) {
      logger.differential('Threshold reached – forcing full analysis for document:', request.documentId);
      this._differentialCounter.set(request.documentId, 0);
      return false;
    }

    // Otherwise proceed with differential
    return true;
  },

  // ✅ DIFFERENTIAL ANALYSIS - Process differential analysis request
  async requestDifferentialAnalysis(request: DifferentialAnalysisRequest): Promise<DifferentialAnalysisResponse> {
    try {
      logger.differential('Starting differential analysis', {
        documentId: request.documentId,
        contentLength: request.content.length
      });

      // Get unanalyzed changes
      const unanalyzedChanges = await modificationTrackingService.getUnanalyzedChanges(
        request.documentId,
        request.userId
      );

      if (unanalyzedChanges.length === 0) {
        logger.differential('No unanalyzed changes found, skipping analysis');
        return {
          suggestions: [],
          analysisId: 'no-changes-differential',
          processingTime: 0,
          differentialMetadata: {
            isDifferential: true,
            changedParagraphs: 0,
            mergedSuggestions: 0,
            skippedAnalysis: true
          }
        };
      }

      // Extract changed paragraph indices
      const changedParagraphIndices = unanalyzedChanges.flatMap(change => 
        change.changes.map(c => c.paragraphIndex)
      );

      // Remove duplicates
      const uniqueChangedIndices = [...new Set(changedParagraphIndices)];

      logger.differential('Processing changes', {
        changeRecords: unanalyzedChanges.length,
        uniqueChangedParagraphs: uniqueChangedIndices.length
      });

      // Build context window around changed paragraphs
      const paragraphs = contentAnalysisService.splitIntoParagraphs(request.content);
      const contextWindow = contentAnalysisService.buildContextWindow(
        paragraphs,
        uniqueChangedIndices,
        3 // ±3 paragraphs context
      );

      if (contextWindow.length === 0) {
        logger.differential('Empty context window, skipping analysis');
        return {
          suggestions: [],
          analysisId: 'empty-context-differential',
          processingTime: 0,
          differentialMetadata: {
            isDifferential: true,
            changedParagraphs: uniqueChangedIndices.length,
            mergedSuggestions: 0,
            skippedAnalysis: true
          }
        };
      }

      // Prepare optimized request with differential context
      const optimizedRequest: OptimizedAnalysisRequest = {
        contextWindow,
        documentSummary: contentAnalysisService.generateDocumentSummary(request.content),
        totalParagraphs: paragraphs.length,
        changedParagraphCount: uniqueChangedIndices.length,
        isFullDocument: false
      };

      // Execute differential analysis
      const differentialResponse = await this.executeDifferentialAnalysis({
        ...request,
        optimizedAnalysis: optimizedRequest
      });

      // Merge differential suggestions with existing suggestions
      const mergedSuggestions = await this.mergeDifferentialSuggestions(
        request.documentId,
        request.userId,
        differentialResponse.suggestions || [],
        uniqueChangedIndices,
        paragraphs
      );

      // Mark changes as analyzed
      const changeRecordIds = unanalyzedChanges.map(change => change.id!);
      await modificationTrackingService.markChangesAsAnalyzed(
        changeRecordIds,
        differentialResponse.analysisId || 'differential-analysis'
      );

      logger.differential('Analysis completed', {
        originalSuggestions: differentialResponse.suggestions?.length || 0,
        mergedSuggestions: mergedSuggestions.length,
        tokenSavings: `${Math.round(((paragraphs.length - contextWindow.length) / paragraphs.length) * 100)}%`
      });

      // Apply confidence filter and de-duplication
      const filtered = this.filterSuggestions(mergedSuggestions);
      const deduped = this.removeDuplicateSuggestions(filtered);

      return {
        ...differentialResponse,
        suggestions: deduped,
        differentialMetadata: {
          isDifferential: true,
          changedParagraphs: uniqueChangedIndices.length,
          mergedSuggestions: deduped.length,
          skippedAnalysis: false
        }
      };
    } catch (error) {
      logger.error('Error in differential analysis:', error);
      // Fallback to full analysis if differential fails
      logger.differential('Falling back to full analysis');
      return await this.requestFullAnalysis(request);
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Execute differential analysis via Firebase function
  async executeDifferentialAnalysis(request: DifferentialAnalysisRequest): Promise<SuggestionResponse> {
    // Get previously modified areas to include in the request
    const modifiedAreas = await modificationTrackingService.getModifiedAreas(
      request.documentId, 
      request.userId
    );

    // Get paragraph tags to exclude "Done" paragraphs from AI analysis
    const paragraphTags = await paragraphTagService.getDocumentTags(
      request.documentId,
      request.userId
    );

    // Use writing goals from the request if provided, otherwise use the global store
    let writingGoals;
    if (request.writingGoals) {
      writingGoals = request.writingGoals;
      console.log('📚 Using writing goals from request for differential analysis.');
    } else {
      const writingGoalsState = useWritingGoalsStore.getState();
      const { goals, getGrammarStrictness, getVocabularyLevel, getToneRecommendation } = writingGoalsState;

      writingGoals = {
        academicLevel: goals.academicLevel,
        assignmentType: goals.assignmentType,
        customInstructions: goals.customInstructions,
        grammarStrictness: getGrammarStrictness(),
        vocabularyLevel: getVocabularyLevel(),
        toneRecommendation: getToneRecommendation()
      };
    }

    // ✅ DIFFERENTIAL ANALYSIS OPTIMIZATION - Build context window for changed paragraphs only
    const unanalyzedChanges = await modificationTrackingService.getUnanalyzedChanges(
      request.documentId,
      request.userId
    );

    let optimizedRequest: OptimizedAnalysisRequest | null = null;
    let tokenSavings: { originalTokens: number; optimizedTokens: number; savings: number } | null = null;

    if (unanalyzedChanges.length > 0) {
      // Extract changed paragraph indices
      const changedParagraphIndices = unanalyzedChanges.flatMap(change => 
        change.changes.map(c => c.paragraphIndex)
      );

      // Create optimized request with context window around changed paragraphs
      const paragraphs = contentAnalysisService.splitIntoParagraphs(request.content);
      
      // ✅ SMART FALLBACK - If too many paragraphs changed, use full analysis instead
      const changePercentage = (changedParagraphIndices.length / paragraphs.length) * 100;
      
      if (changePercentage > 60) {
        logger.differential(`Too many changes (${Math.round(changePercentage)}%), falling back to full analysis`);
        // Fall back to full analysis
        optimizedRequest = null;
      } else {
        const contextWindow = contentAnalysisService.buildContextWindow(
          paragraphs,
          changedParagraphIndices,
          1 // ±1 paragraph context (more aggressive optimization for better token savings)
        );

        optimizedRequest = {
          contextWindow,
          changedParagraphCount: changedParagraphIndices.length,
          totalParagraphs: paragraphs.length,
          isFullDocument: false
        };

        logger.debug('OptimizedRequest created', {
          contextWindowLength: contextWindow.length, 
          isFullDocument: optimizedRequest.isFullDocument,
          changedParagraphCount: optimizedRequest.changedParagraphCount,
          totalParagraphs: optimizedRequest.totalParagraphs
        });

        // Calculate token savings
        tokenSavings = contentAnalysisService.estimateTokenSavings(
          request.content,
          contextWindow
        );

        logger.differential('Context window optimization', {
          totalParagraphs: paragraphs.length,
          changedParagraphs: changedParagraphIndices.length,
          contextWindowSize: contextWindow.length,
          tokenSavings: tokenSavings ? `${tokenSavings.savings}%` : 'N/A'
        });
      }
    }

    const enhancedRequest = {
      ...request,
      previouslyModifiedAreas: modifiedAreas,
      writingGoals,
      paragraphTags,
      // Mark this as a differential analysis request
      isDifferentialAnalysis: true,
      // Add differential analysis optimization
      optimizedAnalysis: optimizedRequest
    };

    logger.debug('Calling Firebase function', {
      hasOptimizedAnalysis: !!enhancedRequest.optimizedAnalysis,
      contextWindowLength: enhancedRequest.optimizedAnalysis?.contextWindow?.length || 0,
      isDifferentialAnalysis: enhancedRequest.isDifferentialAnalysis
    });

    const functions = getFunctions();
    const analyzeSuggestions = httpsCallable(functions, 'analyzeSuggestions');
    const result = await analyzeSuggestions(enhancedRequest);
    
    // Add optimization metadata to response
    const response = result.data as SuggestionResponse;
    
    console.log('🔍 [DifferentialAnalysis] DEBUG - Firebase response received:', {
      hasOptimizationMetadata: !!response.optimizationMetadata,
      usedContextWindow: response.optimizationMetadata?.usedContextWindow,
      tokenSavings: response.optimizationMetadata?.tokenSavings,
      processingTime: response.processingTime,
      suggestionsCount: response.suggestions?.length || 0
    });
    
    // ✅ EASY TO SPOT SUMMARY LOG
    const actualSavings = response.optimizationMetadata?.tokenSavings?.savings || 0;
    const usedOptimization = response.optimizationMetadata?.usedContextWindow || false;
    console.log(`🎯 DIFFERENTIAL ANALYSIS SUMMARY: ${usedOptimization ? '✅ OPTIMIZATION USED' : '❌ NO OPTIMIZATION'} | Token Savings: ${actualSavings}%`);
    
    return {
      ...response,
      optimizationMetadata: {
        ...response.optimizationMetadata,
        usedContextWindow: !!optimizedRequest,
        tokenSavings: tokenSavings,
        contextWindowSize: optimizedRequest?.contextWindow.length || 0,
      }
    };
  },

  // ✅ DIFFERENTIAL ANALYSIS - Merge differential suggestions with existing suggestions
  async mergeDifferentialSuggestions(
    documentId: string,
    userId: string,
    newSuggestions: Suggestion[],
    changedParagraphIndices: number[],
    paragraphs: string[]
  ): Promise<Suggestion[]> {
    try {
      console.log('🔍 [DifferentialAnalysis] Merging differential suggestions:', {
        newSuggestions: newSuggestions.length,
        changedParagraphs: changedParagraphIndices.length
      });

      // Get existing suggestions for the document
      const existingSuggestions = await this.getDocumentSuggestions(documentId, userId);

      // Group existing suggestions by paragraph using the *actual* paragraph list
      const existingSuggestionsByParagraph = new Map<number, Suggestion[]>();
      
      existingSuggestions.forEach(suggestion => {
        const paragraphIndex = this.calculateParagraphIndex(suggestion.startIndex, paragraphs);
        if (!existingSuggestionsByParagraph.has(paragraphIndex)) {
          existingSuggestionsByParagraph.set(paragraphIndex, []);
        }
        existingSuggestionsByParagraph.get(paragraphIndex)!.push(suggestion);
      });

      // Remove suggestions from changed paragraphs (they'll be replaced with new ones)
      const unchangedSuggestions = existingSuggestions.filter(suggestion => {
        const paragraphIndex = this.calculateParagraphIndex(suggestion.startIndex, paragraphs);
        return !changedParagraphIndices.includes(paragraphIndex);
      });

      // Combine unchanged suggestions with new differential suggestions
      const mergedSuggestions = [...unchangedSuggestions, ...newSuggestions];

      // Remove duplicates and sort by position
      const uniqueSuggestions = this.removeDuplicateSuggestions(mergedSuggestions);
      const sortedSuggestions = uniqueSuggestions.sort((a, b) => a.startIndex - b.startIndex);

      console.log('🔍 [DifferentialAnalysis] Suggestions merged:', {
        existing: existingSuggestions.length,
        unchanged: unchangedSuggestions.length,
        new: newSuggestions.length,
        final: sortedSuggestions.length
      });

      return sortedSuggestions;
    } catch (error) {
      console.error('🔍 [DifferentialAnalysis] Error merging suggestions:', error);
      // Fallback to just returning new suggestions
      return newSuggestions;
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Calculate paragraph index from character position
  calculateParagraphIndex(startIndex: number, paragraphs: string[]): number {
    let currentIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraphLength = paragraphs[i].length + 2; // +2 for \n\n
      if (startIndex >= currentIndex && startIndex < currentIndex + paragraphLength) {
        return i;
      }
      currentIndex += paragraphLength;
    }
    return Math.max(0, paragraphs.length - 1); // Return last paragraph index as fallback
  },

  // ✅ DIFFERENTIAL ANALYSIS - Remove duplicate suggestions
  removeDuplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    // We consider a suggestion duplicate if it proposes the *exact* same change,
    // irrespective of the character indices. This prevents identical suggestions
    // (often generated by incremental analyses) from appearing multiple times.
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      // Create a unique key based on change semantics only
      const key = `${suggestion.originalText}→${suggestion.suggestedText}-${suggestion.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  },

  /**
   * Filters out suggestions that are obviously invalid or duplicate.
   *
   * NOTE (2024-06-22): We used to hide low-severity clarity / engagement /
   * vocabulary items, but users reported that this discards valuable feedback
   * on weaker drafts.  The filter now keeps *all* severities so the UI can
   * decide what to surface (e.g., via future "Show minor issues" toggle).
   */
  filterSuggestions(suggestions: Suggestion[]): Suggestion[] {
    return suggestions; // No severity filtering – keep everything
  },

  // ✅ DIFFERENTIAL ANALYSIS - Full analysis (original implementation)
  async requestFullAnalysis(request: DifferentialAnalysisRequest): Promise<DifferentialAnalysisResponse> {
    const startTime = Date.now(); // Track performance timing
    try {
      const documentKey = `${request.documentId}_${request.userId}`;
      this._previousContent.set(documentKey, request.content);

      // Get previously modified areas to include in the request
      const modifiedAreas = await modificationTrackingService.getModifiedAreas(
        request.documentId, 
        request.userId
      );

      // Get paragraph tags to exclude "Done" paragraphs from AI analysis
      const paragraphTags = await paragraphTagService.getDocumentTags(
        request.documentId,
        request.userId
      );

      // Use writing goals from the request if provided, otherwise use the global store
      let writingGoals;
      if (request.writingGoals) {
        writingGoals = request.writingGoals;
        console.log('📚 Using writing goals from request for testing.');
      } else {
        const writingGoalsState = useWritingGoalsStore.getState();
        const { goals, getGrammarStrictness, getVocabularyLevel, getToneRecommendation } = writingGoalsState;

        writingGoals = {
          academicLevel: goals.academicLevel,
          assignmentType: goals.assignmentType,
          customInstructions: goals.customInstructions,
          grammarStrictness: getGrammarStrictness(),
          vocabularyLevel: getVocabularyLevel(),
          toneRecommendation: getToneRecommendation()
        };
      }

      console.log('📚 Writing Goals being sent to AI:', writingGoals);

      const enhancedRequest = {
        ...request,
        previouslyModifiedAreas: modifiedAreas,
        writingGoals,
        paragraphTags,
        // Add context window optimization data
        optimizedAnalysis: null
      };

      const functions = getFunctions();
      const analyzeSuggestions = httpsCallable(functions, 'analyzeSuggestions');
      const result = await analyzeSuggestions(enhancedRequest);
      
      // Add optimization metadata to response
      const response = result.data as SuggestionResponse;
      const enhancedResponse: DifferentialAnalysisResponse = {
        ...response,
        optimizationMetadata: {
          // Preserve metadata from the function response (like cacheHit)
          ...response.optimizationMetadata, 
          // Add client-side metadata
          usedContextWindow: false,
          tokenSavings: null,
          contextWindowSize: 0,
        },
        differentialMetadata: {
          isDifferential: false,
          changedParagraphs: 0,
          mergedSuggestions: response.suggestions?.length || 0,
          skippedAnalysis: false
        }
      };

      // ✅ PERFORMANCE LOGGING - Log optimization results when enabled
      logger.performance('Analysis completed', {
        responseTime: `${response.processingTime || 0}ms`,
        usedContextWindow: false,
        contextWindowSize: 0,
        suggestionsGenerated: response.suggestions?.length || 0,
        cacheHit: response.optimizationMetadata?.cacheHit || false,
        tokenSavings: 'None'
      });

      // ✅ DIFFERENTIAL ANALYSIS MONITORING - Record performance metrics
      try {
        const metric = differentialAnalysisMonitor.createMetricFromResponse(
          request.userId,
          request.documentId,
          enhancedResponse,
          startTime,
          request.analysisType === 'incremental'
        );
        await differentialAnalysisMonitor.recordAnalysisMetric(metric);
      } catch (monitoringError) {
        logger.warn('Failed to record differential analysis metrics:', monitoringError);
        // Don't throw - monitoring should not break the main functionality
      }

      // Apply confidence filter and de-duplication
      const filtered = this.filterSuggestions(enhancedResponse.suggestions || []);
      const deduped = this.removeDuplicateSuggestions(filtered);

      return {
        ...enhancedResponse,
        suggestions: deduped
      };
    } catch (error) {
      logger.error('Error requesting suggestions:', error);
      
      // ✅ DIFFERENTIAL ANALYSIS MONITORING - Record error metrics
      try {
        const errorMetric = {
          userId: request.userId,
          documentId: request.documentId,
          analysisType: 'full' as const,
          performance: {
            processingTime: Date.now() - startTime,
            tokenSavings: 0,
            contextWindowSize: 0,
            changedParagraphs: 0,
            totalParagraphs: 0
          },
          effectiveness: {
            suggestionsGenerated: 0,
            cacheHit: false,
            errorOccurred: true
          },
          userExperience: {
            perceivedSpeed: 'slow' as const,
            autoAnalysis: request.analysisType === 'incremental',
            userTriggered: request.analysisType !== 'incremental'
          }
        };
        await differentialAnalysisMonitor.recordAnalysisMetric(errorMetric);
      } catch (monitoringError) {
        logger.warn('Failed to record error metrics:', monitoringError);
      }
      
      throw error;
    }
  },

  // Request essay structure analysis
  async requestStructureAnalysis(request: StructureAnalysisRequest): Promise<StructureAnalysisResponse> {
    try {
      console.log('🏗️ Requesting structure analysis:', request);
      console.log('🏗️ Request details:', {
        contentLength: request.content.length,
        documentId: request.documentId,
        userId: request.userId,
        assignmentType: request.assignmentType,
        academicLevel: request.academicLevel
      });

      const functions = getFunctions();
      const analyzeEssayStructure = httpsCallable(functions, 'analyzeEssayStructure');
      
      console.log('🏗️ Calling Firebase function...');
      const result = await analyzeEssayStructure(request);
      
      console.log('🏗️ Structure analysis result:', result);
      return result.data as StructureAnalysisResponse;
    } catch (error) {
      console.error('❌ Error requesting structure analysis:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error constructor:', error?.constructor?.name);
      
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('❌ Firebase error code:', (error as any).code);
        console.error('❌ Firebase error message:', (error as any).message);
        console.error('❌ Firebase error details:', (error as any).details);
      }
      
      throw error;
    }
  },

  // Get latest structure analysis for a document
  async getDocumentStructure(documentId: string, userId: string): Promise<EssayStructure | null> {
    try {
      const q = query(
        collection(db, 'essayStructures'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as unknown as EssayStructure;
    } catch (error) {
      console.error('Error fetching document structure:', error);
      throw error;
    }
  },

  // Enhanced function to get document suggestions with accepted suggestion filtering
  async getDocumentSuggestions(documentId: string, userId: string): Promise<Suggestion[]> {
    try {
      console.log('📋 [SuggestionService] Loading suggestions for document:', documentId);
      
      // Get all suggestions for the document (including accepted ones for tracking)
      const q = query(
        collection(db, 'suggestions'),
        where('documentId', '==', documentId),
        where('userId', '==', userId)
        // where('status', '==', 'pending') // Temporarily removed for debugging
        // Temporarily removed orderBy for debugging: orderBy('startIndex', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const allSuggestions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Suggestion[];
      
      // Separate accepted and pending suggestions
      const acceptedSuggestions = allSuggestions.filter(s => s.status === 'accepted');
      const pendingSuggestions = allSuggestions.filter(s => s.status === 'pending');
      
      console.log(`📋 [SuggestionService] Found ${pendingSuggestions.length} pending, ${acceptedSuggestions.length} accepted suggestions`);
      
      // Filter out pending suggestions that duplicate already-accepted changes
      const filteredPendingSuggestions = pendingSuggestions.filter(pendingSuggestion => {
        // Check if this pending suggestion targets content that was already modified by an accepted suggestion
        const isDuplicate = acceptedSuggestions.some(acceptedSuggestion => {
          // Check for exact text match (same original text)
          const sameOriginalText = pendingSuggestion.originalText === acceptedSuggestion.originalText;
          
          // Check for overlapping indices (targeting same area)
          const overlapping = !(
            pendingSuggestion.endIndex <= acceptedSuggestion.startIndex ||
            pendingSuggestion.startIndex >= acceptedSuggestion.endIndex
          );
          
          // Check for similar suggestion types targeting similar content
          const similarTypes = pendingSuggestion.type === acceptedSuggestion.type && 
                              pendingSuggestion.originalText.toLowerCase().includes(acceptedSuggestion.originalText.toLowerCase());
          
          const isDupe = sameOriginalText || (overlapping && similarTypes);
          
          if (isDupe) {
            console.log(`🚫 [SuggestionService] Filtering duplicate suggestion:`, {
              pending: pendingSuggestion.originalText,
              accepted: acceptedSuggestion.originalText,
              reason: sameOriginalText ? 'same text' : 'overlapping similar'
            });
          }
          
          return isDupe;
        });
        
        return !isDuplicate;
      });
      
      console.log(`📋 [SuggestionService] Returning ${filteredPendingSuggestions.length} non-duplicate suggestions`);
      return filteredPendingSuggestions;
      
    } catch (error) {
      console.error('❌ [SuggestionService] Error loading suggestions:', error);
      return [];
    }
  },

  // Accept a suggestion
  async acceptSuggestion(suggestionId: string): Promise<void> {
    try {
      const suggestionRef = doc(db, 'suggestions', suggestionId);
      await updateDoc(suggestionRef, {
        status: 'accepted',
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      throw error;
    }
  },

  // Reject a suggestion
  async rejectSuggestion(suggestionId: string): Promise<void> {
    try {
      const suggestionRef = doc(db, 'suggestions', suggestionId);
      await updateDoc(suggestionRef, {
        status: 'rejected',
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      throw error;
    }
  },

  // Delete a suggestion
  async deleteSuggestion(suggestionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'suggestions', suggestionId));
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      throw error;
    }
  },

  // Subscribe to real-time suggestion updates
  subscribeToSuggestions(
    documentId: string,
    userId: string,
    callback: (suggestions: Suggestion[]) => void,
    onError: (error: Error) => void
  ): () => void {
    if (!userId) {
      console.warn("User ID is not available, skipping suggestion subscription.");
      return () => {}; // Return an empty unsubscribe function
    }

    const q = query(
      collection(db, 'suggestions'),
      where('documentId', '==', documentId),
      where('userId', '==', userId),
      where('status', '==', 'pending'), // ✅ FIXED: Re-enabled status filter
      orderBy('startIndex', 'asc') // ✅ FIXED: Re-enabled ordering
    );

    console.log('📡 [SuggestionService] Setting up onSnapshot with query:', {
      documentId,
      userId,
      filters: ['status == pending', 'orderBy startIndex'],
      queryPath: `suggestions where documentId==${documentId} AND userId==${userId} AND status==pending`
    });

    // 🔍 DEBUG: Test the query manually first
    getDocs(q).then(testSnapshot => {
      console.log('📡 [SuggestionService] Manual query test results:', {
        totalDocs: testSnapshot.docs.length,
        docs: testSnapshot.docs.slice(0, 3).map(doc => ({
          id: doc.id,
          status: doc.data().status,
          originalText: doc.data().originalText,
          type: doc.data().type
        }))
      });
    }).catch(testError => {
      console.error('📡 [SuggestionService] Manual query test FAILED:', testError);
    });

    return onSnapshot(q, (snapshot) => {
      console.log(`📋 [SuggestionService] Real-time update: ${snapshot.docs.length} suggestions received`);
      
      try {
        const suggestions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Suggestion[];

        console.log(`📋 [SuggestionService] Parsed suggestions:`, {
          count: suggestions.length,
          sample: suggestions.slice(0, 2).map(s => ({
            id: s.id,
            originalText: s.originalText,
            type: s.type,
            status: s.status
          }))
        });

        callback(suggestions);
      } catch (error) {
        console.error('❌ [SuggestionService] Error parsing suggestions in subscription:', error);
        callback([]); // Fallback to empty array
      }
    }, (error) => {
      console.error('❌ [SuggestionService] Error in suggestions subscription:', error);
      onError(error);
    });
  },
};