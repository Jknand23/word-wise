import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Suggestion, SuggestionRequest, ParagraphTag } from '../types/suggestion';
import { suggestionService } from '../services/suggestionService';
import { modificationTrackingService } from '../services/modificationTrackingService';
// import { paragraphTagService } from '../services/paragraphTagService';
// Debug utility moved to temp folder for deployment
// import { logger } from '../utils/logger';

// Temporary logger stub for deployment
const logger = {
  debug: (message: string, ...args: unknown[]) => console.log('[DEBUG]', message, ...args),
  info: (message: string, ...args: unknown[]) => console.log('[INFO]', message, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn('[WARN]', message, ...args),
  error: (message: string, ...args: unknown[]) => console.error('[ERROR]', message, ...args),
};

interface SuggestionStore {
  // State
  suggestions: Suggestion[];
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  activeDocumentId: string | null;
  unsubscribe: (() => void) | null;
  
  // Actions
  setActiveDocument: (documentId: string, userId: string) => void;
  loadSuggestions: (documentId: string, userId: string) => Promise<void>;
  requestAnalysis: (request: SuggestionRequest) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => Promise<void>;
  rejectSuggestion: (suggestionId: string) => Promise<void>;
  deleteSuggestion: (suggestionId: string) => Promise<void>;
  subscribeToDocument: (documentId: string, userId: string) => () => void;
  clearSuggestions: () => void;
  setError: (error: string | null) => void;
  getFilteredSuggestions: (content: string, paragraphTags: ParagraphTag[]) => Suggestion[];
}

export const useSuggestionStore = create<SuggestionStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      suggestions: [],
      isLoading: false,
      isAnalyzing: false,
      error: null,
      activeDocumentId: null,
      unsubscribe: null,

      // Set active document
      setActiveDocument: (documentId: string, userId: string) => {
        console.log('📄 [SuggestionStore] Setting active document:', { documentId, userId });
        const { unsubscribe, activeDocumentId } = get();
        if (activeDocumentId === documentId && unsubscribe) {
          console.log('📄 [SuggestionStore] Already subscribed to this document, skipping');
          return; // Already subscribed to this document
        }

        if (unsubscribe) {
          console.log('📄 [SuggestionStore] Unsubscribing from previous document');
          unsubscribe(); // Unsubscribe from the previous document
        }

        if (!userId) {
          console.log('📄 [SuggestionStore] No user ID provided');
          set({ error: "User not authenticated. Cannot load suggestions.", unsubscribe: null });
          return;
        }

        console.log('📄 [SuggestionStore] Setting up subscription for document:', documentId);
        set({ activeDocumentId: documentId, isLoading: true, error: null });
        const newUnsubscribe = get().subscribeToDocument(documentId, userId);
        set({ unsubscribe: newUnsubscribe });
      },

      // Load suggestions for a document
      loadSuggestions: async (documentId: string, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const suggestions = await suggestionService.getDocumentSuggestions(documentId, userId);
          set({ suggestions, isLoading: false });
        } catch (error) {
          console.error('Failed to load suggestions:', error);
          const errorMessage = error instanceof Error && error.message.includes('failed-precondition')
            ? 'Database indexes are being built. Please try again in a few minutes.'
            : error instanceof Error ? error.message : 'Failed to load suggestions';
          set({ 
            error: errorMessage,
            isLoading: false 
          });
        }
      },

      // Request AI analysis
      requestAnalysis: async (request: SuggestionRequest) => {
        console.log('🔬 [SuggestionStore] Starting AI analysis:', {
          documentId: request.documentId,
          contentLength: request.content.length,
          analysisType: request.analysisType || 'full'
        });
        set({ isAnalyzing: true, error: null });
        
        try {
          // Clean up old modifications before analysis
          await modificationTrackingService.cleanupOldModifications(request.documentId, request.userId);
          
          // Request suggestions, but don't use the response directly.
          // The real-time listener will pick up the changes from Firestore.
          const response = await suggestionService.requestSuggestions(request);
          console.log('🔬 [SuggestionStore] Analysis request completed:', response);
          
          console.log('🔬 [SuggestionStore] AI analysis request sent. Waiting for real-time update.');

          set({ isAnalyzing: false });
        } catch (error) {
          console.error('🔬 [SuggestionStore] AI analysis failed:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to analyze document',
            isAnalyzing: false 
          });
        }
      },

      // Accept suggestion
      acceptSuggestion: async (suggestionId: string) => {
        set({ error: null });
        try {
          await suggestionService.acceptSuggestion(suggestionId);
          
          // Get current suggestions
          const currentSuggestions = get().suggestions;
          const acceptedSuggestion = currentSuggestions.find(s => s.id === suggestionId);
          
          if (acceptedSuggestion) {
            // Track the modification for clarity and engagement suggestions
            logger.debug(`Tracking ${acceptedSuggestion.type} suggestion acceptance`);
            await modificationTrackingService.trackModification(
              acceptedSuggestion, 
              acceptedSuggestion.suggestedText
            );

            // Remove any overlapping pending suggestions of the same type whose originalText
            // no longer appears at their indices in the updated content (client-side stale cleanup)
            const pruned = currentSuggestions.filter(s => {
              if (s.id === suggestionId) return false;
              // Overlap check
              const overlaps = !(s.endIndex <= acceptedSuggestion.startIndex || acceptedSuggestion.endIndex <= s.startIndex);
              // Keep non-overlapping
              if (!overlaps) return true;
              // If overlapping and same type, drop to avoid double-fixing cascade
              if (s.type === acceptedSuggestion.type) return false;
              return true;
            });
            set({ suggestions: pruned });
          }

          // Remove the accepted suggestion from any remaining list (safety)
          set(state => ({ suggestions: state.suggestions.filter(s => s.id !== suggestionId) }));
          
        } catch (error) {
          console.error('Failed to accept suggestion:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to accept suggestion'
          });
        }
      },

      // Reject a suggestion
      rejectSuggestion: async (suggestionId: string) => {
        set({ error: null });
        try {
          await suggestionService.rejectSuggestion(suggestionId);
          // Remove from suggestions list
          const currentSuggestions = get().suggestions;
          const updatedSuggestions = currentSuggestions.filter(s => s.id !== suggestionId);
          set({ suggestions: updatedSuggestions });
        } catch (error) {
          console.error('Failed to reject suggestion:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to reject suggestion'
          });
        }
      },

      // Delete a suggestion
      deleteSuggestion: async (suggestionId: string) => {
        set({ error: null });
        try {
          await suggestionService.deleteSuggestion(suggestionId);
          // Remove from suggestions list
          const currentSuggestions = get().suggestions;
          const updatedSuggestions = currentSuggestions.filter(s => s.id !== suggestionId);
          set({ suggestions: updatedSuggestions });
        } catch (error) {
          console.error('Failed to delete suggestion:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete suggestion'
          });
        }
      },

      // Subscribe to real-time updates
      subscribeToDocument: (documentId: string, userId: string) => {
        console.log('📡 [SuggestionStore] Setting up real-time subscription:', { documentId, userId });
        if (!userId) {
          console.log('📡 [SuggestionStore] Cannot subscribe - no user ID');
          set({ error: "User not authenticated. Cannot subscribe to suggestions." });
          return () => {};
        }
        
        return suggestionService.subscribeToSuggestions(
          documentId,
          userId,
          (suggestions) => { // onNext
            console.log('🔔 [SuggestionStore] Subscription callback received:', {
              suggestionsCount: suggestions.length,
              documentId,
              suggestions: suggestions.slice(0, 2) // Show first 2 for debugging
            });
            set({ suggestions, isLoading: false, error: null });
          },
          (error) => { // onError
            const errorMessage = error.message.includes('failed-precondition')
              ? 'A database index is required for this feature. Please check your Firestore configuration.'
              : 'Unable to load suggestions due to a server error.';
            set({ error: errorMessage, isLoading: false, suggestions: [] });
          }
        );
      },

      // Clear suggestions
      clearSuggestions: () => {
        const { unsubscribe } = get();
        if (unsubscribe) {
          unsubscribe();
        }
        set({
          suggestions: [],
          activeDocumentId: null,
          error: null,
          unsubscribe: null,
          isLoading: false,
          isAnalyzing: false
        });
      },

      // Set error
      setError: (error: string | null) => {
        set({ error });
      },

      // Filter suggestions to exclude those from "Done" paragraphs
      getFilteredSuggestions: (_content: string, _paragraphTags: ParagraphTag[]) => {
        void _content;
        void _paragraphTags;
        const { suggestions } = get();
        return suggestions;
      },


    }),
    {
      name: 'suggestion-store',
    }
  )
); 