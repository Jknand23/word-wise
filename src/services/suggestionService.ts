import { collection, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import type { Suggestion, SuggestionRequest, SuggestionResponse } from '../types/suggestion';
import { modificationTrackingService } from './modificationTrackingService';


export const suggestionService = {
  // Trigger AI analysis via Cloud Function
  async requestSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    try {
      // Get previously modified areas to include in the request
      const modifiedAreas = await modificationTrackingService.getModifiedAreas(
        request.documentId, 
        request.userId
      );

      const enhancedRequest = {
        ...request,
        previouslyModifiedAreas: modifiedAreas
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