import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import type { 
  AssignmentRubric, 
  RubricFeedback
} from '../types/suggestion';

export const rubricService = {
  // Parse raw rubric text using AI
  async parseRubricText(
    rawText: string, 
    documentId: string, 
    userId: string,
    title: string = 'Assignment Rubric'
  ): Promise<AssignmentRubric> {
    try {
      const functions = getFunctions();
      const parseRubric = httpsCallable(functions, 'parseAssignmentRubric');
      
      const result = await parseRubric({
        rawText,
        documentId,
        userId,
        title
      });
      
      const parsedRubric = result.data as Omit<AssignmentRubric, 'id' | 'createdAt' | 'updatedAt'>;
      
      // Save to Firestore
      const rubricRef = await addDoc(collection(db, 'rubrics'), {
        ...parsedRubric,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return {
        ...parsedRubric,
        id: rubricRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error parsing rubric:', error);
      throw error;
    }
  },

  // Get rubric by ID
  async getRubric(rubricId: string): Promise<AssignmentRubric | null> {
    try {
      const rubricDoc = await getDoc(doc(db, 'rubrics', rubricId));
      if (!rubricDoc.exists()) {
        return null;
      }
      
      const data = rubricDoc.data();
      return {
        id: rubricDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as AssignmentRubric;
    } catch (error) {
      console.error('Error fetching rubric:', error);
      throw error;
    }
  },

  // Get all rubrics for a document
  async getDocumentRubrics(documentId: string, userId: string): Promise<AssignmentRubric[]> {
    try {
      const q = query(
        collection(db, 'rubrics'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as AssignmentRubric[];
    } catch (error) {
      console.error('Error fetching document rubrics:', error);
      throw error;
    }
  },

  // Update rubric
  async updateRubric(rubricId: string, updates: Partial<AssignmentRubric>): Promise<void> {
    try {
      const rubricRef = doc(db, 'rubrics', rubricId);
      await updateDoc(rubricRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating rubric:', error);
      throw error;
    }
  },

  // Delete rubric
  async deleteRubric(rubricId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'rubrics', rubricId));
    } catch (error) {
      console.error('Error deleting rubric:', error);
      throw error;
    }
  },

  // Request rubric-based analysis
  async requestRubricAnalysis(
    content: string,
    documentId: string,
    userId: string,
    rubric: AssignmentRubric,
    academicLevel: string
  ): Promise<{ feedback: RubricFeedback; suggestions: unknown[]; analysisId: string; processingTime: number }> {
    try {
      console.log('RubricService: Requesting analysis with academic level:', academicLevel);
      const functions = getFunctions();
      const analyzeWithRubric = httpsCallable(functions, 'analyzeWithRubric');
      const result = await analyzeWithRubric({
        content,
        documentId,
        userId,
        rubric,
        academicLevel,
      });

      if (!result.data) {
        throw new Error("No data returned from rubric analysis function");
      }

      return result.data as { feedback: RubricFeedback; suggestions: unknown[]; analysisId: string; processingTime: number };
    } catch (error) {
      console.error('Error requesting rubric analysis:', error);
      throw error;
    }
  },

  // Get latest rubric feedback for a document
  async getLatestRubricFeedback(documentId: string, userId: string): Promise<RubricFeedback | null> {
    try {
      const q = query(
        collection(db, 'rubricFeedback'),
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
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as RubricFeedback;
    } catch (error) {
      console.error('Error fetching rubric feedback:', error);
      throw error;
    }
  },

  // Create structured rubric directly (no AI parsing needed)
  async createStructuredRubric(rubricData: Omit<AssignmentRubric, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }> {
    try {
      const rubricRef = await addDoc(collection(db, 'rubrics'), {
        ...rubricData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { id: rubricRef.id };
    } catch (error) {
      console.error('Error creating structured rubric:', error);
      throw error;
    }
  },

  // Helper function to extract basic requirements from text (fallback for when AI parsing fails)
  extractBasicRequirements(text: string): AssignmentRubric['extractedRequirements'] {
    const requirements: AssignmentRubric['extractedRequirements'] = {};
    
    // Word count patterns
    const wordCountMatch = text.match(/(\d+)[-–](\d+)\s*words?/i) || 
                          text.match(/minimum\s*(\d+)\s*words?/i) ||
                          text.match(/at\s*least\s*(\d+)\s*words?/i);
    if (wordCountMatch) {
      if (wordCountMatch[2]) {
        requirements.wordCount = { min: parseInt(wordCountMatch[1]), max: parseInt(wordCountMatch[2]) };
      } else {
        requirements.wordCount = { min: parseInt(wordCountMatch[1]) };
      }
    }
    
    // Citation patterns
    const citationMatch = text.match(/(\d+)[-–](\d+)\s*(?:citations?|sources?|references?)/i) ||
                         text.match(/minimum\s*(\d+)\s*(?:citations?|sources?|references?)/i) ||
                         text.match(/at\s*least\s*(\d+)\s*(?:citations?|sources?|references?)/i);
    if (citationMatch) {
      requirements.citationCount = { min: parseInt(citationMatch[1]) };
    }
    
    // Citation style
    const styleMatch = text.match(/(APA|MLA|Chicago|Harvard)\s*(?:style|format|citation)/i);
    if (styleMatch && requirements.citationCount) {
      const style = styleMatch[1].toUpperCase();
      if (style === 'APA' || style === 'MLA' || style === 'CHICAGO' || style === 'HARVARD') {
        requirements.citationCount.style = style === 'CHICAGO' ? 'Chicago' : style as 'APA' | 'MLA' | 'Harvard';
      }
    }
    
    // Structure keywords
    const structureKeywords = ['introduction', 'thesis', 'body', 'conclusion', 'paragraph', 'outline'];
    const foundStructure = structureKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    );
    if (foundStructure.length > 0) {
      requirements.structure = foundStructure;
    }
    
    return requirements;
  }
}; 