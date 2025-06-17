import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Document {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
}

export interface DocumentData {
  title: string;
  content: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  wordCount: number;
}

class DocumentService {
  private calculateWordCount(text: string): number {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  }

  async createDocument(userId: string, title: string, content: string = ''): Promise<string> {
    try {
      console.log('Creating document for user:', userId, 'title:', title);
      
      const wordCount = this.calculateWordCount(content);
      const docData = {
        title,
        content,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        wordCount,
      };

      console.log('Document data:', docData);
      const docRef = await addDoc(collection(db, 'documents'), docData);
      console.log('Document created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      console.error('Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        userId
      });
      throw new Error(`Failed to create document: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  async getDocument(documentId: string, userId: string): Promise<Document | null> {
    try {
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as DocumentData;
      
      // Verify the document belongs to the user
      if (data.userId !== userId) {
        throw new Error('Access denied: Document does not belong to user');
      }

      return {
        id: docSnap.id,
        title: data.title,
        content: data.content,
        userId: data.userId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        wordCount: data.wordCount,
      };
    } catch (error) {
      console.error('Error getting document:', error);
      throw new Error('Failed to get document');
    }
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    try {
      console.log('Getting documents for user:', userId);
      
      const q = query(
        collection(db, 'documents'),
        where('userId', '==', userId)
        // Temporarily removing orderBy until index is created
        // orderBy('updatedAt', 'desc')
      );

      console.log('Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      console.log('Query completed, documents found:', querySnapshot.size);
      
      const documents: Document[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as DocumentData;
        console.log('Processing document:', doc.id, data.title);
        documents.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          userId: data.userId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          wordCount: data.wordCount,
        });
      });

      // Sort documents manually by updatedAt (newest first) since we removed orderBy
      documents.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      console.log('Returning', documents.length, 'documents');
      return documents;
    } catch (error) {
      console.error('Error getting user documents:', error);
      console.error('Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        userId
      });
      throw new Error(`Failed to get user documents: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  async updateDocument(documentId: string, userId: string, updates: Partial<Pick<Document, 'title' | 'content'>>): Promise<void> {
    try {
      const docRef = doc(db, 'documents', documentId);
      
      // First verify the document exists and belongs to the user
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Document not found');
      }

      const data = docSnap.data() as DocumentData;
      if (data.userId !== userId) {
        throw new Error('Access denied: Document does not belong to user');
      }

      // Calculate word count if content is being updated
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      if (updates.content !== undefined) {
        updateData.wordCount = this.calculateWordCount(updates.content);
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating document:', error);
      throw new Error('Failed to update document');
    }
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'documents', documentId);
      
      // First verify the document exists and belongs to the user
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Document not found');
      }

      const data = docSnap.data() as DocumentData;
      if (data.userId !== userId) {
        throw new Error('Access denied: Document does not belong to user');
      }

      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  }

  // Migration function to move localStorage documents to Firestore
  async migrateLocalStorageDocuments(userId: string): Promise<void> {
    try {
      const migratedDocuments: Document[] = [];
      
      // Get all localStorage documents
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('document-')) {
          const docData = JSON.parse(localStorage.getItem(key) || '{}');
          const documentId = await this.createDocument(
            userId,
            docData.title || 'Untitled Document',
            docData.content || ''
          );
          
          migratedDocuments.push({
            id: documentId,
            title: docData.title || 'Untitled Document',
            content: docData.content || '',
            userId,
            createdAt: new Date(docData.lastModified || Date.now()),
            updatedAt: new Date(docData.lastModified || Date.now()),
            wordCount: this.calculateWordCount(docData.content || ''),
          });
          
          // Remove from localStorage after successful migration
          localStorage.removeItem(key);
        }
      }
      
      console.log(`Migrated ${migratedDocuments.length} documents to Firestore`);
    } catch (error) {
      console.error('Error migrating localStorage documents:', error);
      throw new Error('Failed to migrate documents');
    }
  }

  // Test function to verify Firestore connectivity
  async testFirestoreConnection(): Promise<boolean> {
    try {
      console.log('Testing Firestore connection...');
      
      // Try to get the documents collection reference
      const documentsRef = collection(db, 'documents');
      console.log('Collection reference created successfully');
      
      // Try a simple query to test connection
      const testQuery = query(documentsRef);
      const snapshot = await getDocs(testQuery);
      
      console.log('Firestore connection test successful. Collection exists with', snapshot.size, 'documents');
      return true;
    } catch (error) {
      console.error('Firestore connection test failed:', error);
      return false;
    }
  }

  // Create a test document to verify write permissions
  async createTestDocument(userId: string): Promise<string | null> {
    try {
      console.log('Creating test document for user:', userId);
      const testDocId = await this.createDocument(
        userId,
        'Test Document - ' + new Date().toISOString(),
        'This is a test document created to verify Firestore integration is working.'
      );
      console.log('Test document created successfully with ID:', testDocId);
      return testDocId;
    } catch (error) {
      console.error('Failed to create test document:', error);
      return null;
    }
  }
}

export const documentService = new DocumentService(); 