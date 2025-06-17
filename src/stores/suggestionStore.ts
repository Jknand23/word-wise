import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Suggestion, SuggestionRequest } from '../types/suggestion';
import { suggestionService } from '../services/suggestionService';
import { modificationTrackingService } from '../services/modificationTrackingService';

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
        const { unsubscribe, activeDocumentId } = get();
        if (activeDocumentId === documentId && unsubscribe) {
          return; // Already subscribed to this document
        }

        if (unsubscribe) {
          unsubscribe(); // Unsubscribe from the previous document
        }

        if (!userId) {
          set({ error: "User not authenticated. Cannot load suggestions.", unsubscribe: null });
          return;
        }

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
        set({ isAnalyzing: true, error: null });
        try {
          // Clean up old modifications before analysis
          await modificationTrackingService.cleanupOldModifications(request.documentId, request.userId);
          
          await suggestionService.requestSuggestions(request);
          // Suggestions will be updated via real-time subscription
          set({ isAnalyzing: false });
        } catch (error) {
          console.error('Failed to request analysis:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to analyze document',
            isAnalyzing: false 
          });
        }
      },

      // Accept a suggestion
      acceptSuggestion: async (suggestionId: string) => {
        set({ error: null });
        try {
          await suggestionService.acceptSuggestion(suggestionId);
          // Remove accepted suggestion and update indices of remaining suggestions
          const currentSuggestions = get().suggestions;
          const acceptedSuggestion = currentSuggestions.find(s => s.id === suggestionId);
          
          if (acceptedSuggestion) {
            // Track the modification for clarity and engagement suggestions
            console.log(`[SuggestionStore] About to track modification for ${acceptedSuggestion.type} suggestion:`, acceptedSuggestion.id);
            await modificationTrackingService.trackModification(
              acceptedSuggestion, 
              acceptedSuggestion.suggestedText
            );
            console.log(`[SuggestionStore] Successfully tracked modification for ${acceptedSuggestion.type} suggestion:`, acceptedSuggestion.id);

            // Calculate the change in text length
            const lengthDifference = acceptedSuggestion.suggestedText.length - acceptedSuggestion.originalText.length;
            
            // Update indices of all suggestions that come after the accepted one
            const updatedSuggestions = currentSuggestions
              .filter(s => s.id !== suggestionId) // Remove the accepted suggestion
              .map(s => {
                if (s.startIndex > acceptedSuggestion.endIndex) {
                  // Shift indices for suggestions after the accepted one
                  return {
                    ...s,
                    startIndex: s.startIndex + lengthDifference,
                    endIndex: s.endIndex + lengthDifference
                  };
                }
                return s;
              });
            
            set({ suggestions: updatedSuggestions });
          } else {
            // Fallback: just remove the suggestion if we can't find it
            const updatedSuggestions = currentSuggestions.filter(s => s.id !== suggestionId);
            set({ suggestions: updatedSuggestions });
          }
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
        if (!userId) {
          set({ error: "User not authenticated. Cannot subscribe to suggestions." });
          return () => {};
        }
        
        return suggestionService.subscribeToSuggestions(
          documentId,
          userId,
          (suggestions) => { // onNext
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


    }),
    {
      name: 'suggestion-store',
    }
  )
); 