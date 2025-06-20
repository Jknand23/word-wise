import { collection, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import type { Suggestion, SuggestionRequest, SuggestionResponse, StructureAnalysisRequest, StructureAnalysisResponse, EssayStructure, RubricAnalysisRequest, RubricAnalysisResponse } from '../types/suggestion';
import { modificationTrackingService } from './modificationTrackingService';
import { useWritingGoalsStore } from '../store/writingGoalsStore';


export const suggestionService = {
  // Trigger AI analysis via Cloud Function
  async requestSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    try {
      // Get previously modified areas to include in the request
      const modifiedAreas = await modificationTrackingService.getModifiedAreas(
        request.documentId, 
        request.userId
      );

      // Get writing goals settings
      const writingGoalsState = useWritingGoalsStore.getState();
      const { goals, getGrammarStrictness, getVocabularyLevel, getToneRecommendation } = writingGoalsState;

      const writingGoals = {
        academicLevel: goals.academicLevel,
        assignmentType: goals.assignmentType,
        customInstructions: goals.customInstructions,
        grammarStrictness: getGrammarStrictness(),
        vocabularyLevel: getVocabularyLevel(),
        toneRecommendation: getToneRecommendation()
      };

      console.log('📚 Writing Goals being sent to AI:', writingGoals);

      const enhancedRequest = {
        ...request,
        previouslyModifiedAreas: modifiedAreas,
        writingGoals
      };

      const functions = getFunctions();
      const analyzeSuggestions = httpsCallable(functions, 'analyzeSuggestions');
      const result = await analyzeSuggestions(enhancedRequest);
      return result.data as SuggestionResponse;
    } catch (error) {
      console.error('Error requesting suggestions:', error);
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

  // Get suggestions for a document
  async getDocumentSuggestions(documentId: string, userId: string): Promise<Suggestion[]> {
    try {
      const q = query(
        collection(db, 'suggestions'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('startIndex', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Suggestion[];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // If it's an index error, provide a more helpful message
      if (error instanceof Error && error.message.includes('failed-precondition')) {
        throw new Error('Database indexes are being built. Please try again in a few minutes.');
      }
      throw error;
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
      where('status', '==', 'pending'),
      orderBy('startIndex', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const suggestions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Suggestion[];
      callback(suggestions);
    }, (error) => {
      console.error('Error in suggestions subscription:', error);
      onError(error);
    });
  },
};