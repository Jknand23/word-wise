// Minimal suggestionService stub for deployment
// Full implementation moved to temp-debug-files during build

import { httpsCallable, getFunctions } from 'firebase/functions';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import app, { db } from '../lib/firebase';
import type { Suggestion, SuggestionRequest, StructureAnalysisRequest, StructureAnalysisResponse, EssayStructure } from '../types/suggestion';

// Initialize Firebase Functions
const functions = getFunctions(app);

// Simple logger for deployment
const logger = {
  debug: (message: string, ...args: unknown[]) => console.log('[DEBUG]', message, ...args),
  info: (message: string, ...args: unknown[]) => console.log('[INFO]', message, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn('[WARN]', message, ...args),
  error: (message: string, ...args: unknown[]) => console.error('[ERROR]', message, ...args),
};

export const suggestionService = {
  // Request suggestions from Firebase function
  requestSuggestions: async (request: SuggestionRequest) => {
    try {
      const analyzeSuggestions = httpsCallable(functions, 'analyzeSuggestions');
      const response = await analyzeSuggestions(request);
      return response.data;
    } catch (error) {
      logger.error('Failed to request suggestions:', error);
      throw error;
    }
  },

  // Get cached document structure if available
  getDocumentStructure: async (documentId: string, userId: string): Promise<EssayStructure | null> => {
    try {
      const structureRef = doc(db, 'essayStructures', `${userId}_${documentId}`);
      const snap = await getDoc(structureRef);
      if (!snap.exists()) return null;
      const raw = snap.data() as Record<string, unknown>;
      const createdAt = (raw.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() || new Date();
      const updatedAt = (raw.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() || new Date();
      return {
        ...(raw as Omit<EssayStructure, 'createdAt' | 'updatedAt'>),
        createdAt,
        updatedAt,
      } as EssayStructure;
    } catch (error) {
      logger.error('Failed to get document structure:', error);
      return null;
    }
  },

  // Request structure analysis (calls CF if available, otherwise performs a local heuristic and caches)
  requestStructureAnalysis: async (request: StructureAnalysisRequest): Promise<StructureAnalysisResponse> => {
    try {
      // Try calling a cloud function if deployed
      try {
        const analyzeStructure = httpsCallable(functions, 'analyzeStructure');
        const result = await analyzeStructure(request);
        const data = result.data as StructureAnalysisResponse;
        // Cache to Firestore
        await setDoc(doc(db, 'essayStructures', `${request.userId}_${request.documentId}`), {
          ...data.structure,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return data;
      } catch {
        // Fallback: simple heuristic segmentation
        const paragraphs = request.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const sections = paragraphs.map((p, idx) => ({
          id: `${idx}`,
          type: (idx === 0 ? 'introduction' : (idx === paragraphs.length - 1 ? 'conclusion' : 'body-paragraph')) as 'introduction' | 'thesis' | 'body-paragraph' | 'conclusion' | 'transition',
          startIndex: request.content.indexOf(p),
          endIndex: request.content.indexOf(p) + p.length,
          text: p.trim(),
          confidence: 0.75,
          suggestions: [],
          metadata: { paragraphNumber: idx + 1 },
        }));
        const bodyCount = Math.max(0, sections.filter(s => s.type === 'body-paragraph').length);
        const structure: EssayStructure = {
          documentId: request.documentId,
          userId: request.userId,
          sections,
          overallStructure: {
            hasIntroduction: sections.some(s => s.type === 'introduction'),
            hasThesis: request.content.toLowerCase().includes('because') || request.content.toLowerCase().includes('should'),
            bodyParagraphCount: bodyCount,
            hasConclusion: sections.some(s => s.type === 'conclusion'),
            structureScore: Math.min(1, 0.4 + bodyCount * 0.1),
            missingElements: [],
            weakElements: [],
          },
          analysisId: `local_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const response: StructureAnalysisResponse = {
          structure,
          structureSuggestions: [],
          analysisId: structure.analysisId,
          processingTime: 50,
        };
        // Cache to Firestore
        await setDoc(doc(db, 'essayStructures', `${request.userId}_${request.documentId}`), {
          ...structure,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return response;
      }
    } catch (error) {
      logger.error('Failed to request structure analysis:', error);
      throw error;
    }
  },

  // Subscribe to real-time suggestions
  subscribeToSuggestions: (
    documentId: string,
    userId: string,
    onNext: (suggestions: Suggestion[]) => void,
    onError: (error: Error) => void
  ) => {
    // Set up real-time subscription
    const q = query(
      collection(db, 'suggestions'),
      where('documentId', '==', documentId),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );

    return onSnapshot(q, 
      (snapshot) => {
        const suggestions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Suggestion[];
        
        console.log('📋 [SuggestionService] Real-time update:', suggestions.length, 'suggestions received');
        onNext(suggestions);
      },
      (error) => {
        console.error('❌ [SuggestionService] Subscription error:', error);
        onError(error);
      }
    );
  },

  // Accept suggestion
  acceptSuggestion: async (suggestionId: string) => {
    try {
      await updateDoc(doc(db, 'suggestions', suggestionId), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to accept suggestion:', error);
      throw error;
    }
  },

  // Reject suggestion
  rejectSuggestion: async (suggestionId: string) => {
    try {
      await updateDoc(doc(db, 'suggestions', suggestionId), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      logger.error('Failed to reject suggestion:', error);
      throw error;
    }
  },

  // Delete suggestion
  deleteSuggestion: async (suggestionId: string) => {
    try {
      await deleteDoc(doc(db, 'suggestions', suggestionId));
    } catch (error) {
      logger.error('Failed to delete suggestion:', error);
      throw error;
    }
  },

  // Get document suggestions
  getDocumentSuggestions: async (documentId: string, userId: string): Promise<Suggestion[]> => {
    try {
      const q = query(
        collection(db, 'suggestions'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Suggestion[];
    } catch (error) {
      logger.error('Failed to get document suggestions:', error);
      throw error;
    }
  }
}; 