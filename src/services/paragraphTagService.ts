import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ParagraphTag, ParagraphTagData } from '../types/suggestion';

class ParagraphTagService {
  private readonly collectionName = 'paragraphTags';

  async createTag(
    documentId: string,
    userId: string,
    paragraphIndex: number,
    startIndex: number,
    endIndex: number,
    text: string,
    tagType: 'needs-review' | 'done',
    note?: string
  ): Promise<string> {
    try {
      const tagData = {
        documentId,
        userId,
        paragraphIndex,
        startIndex,
        endIndex,
        text,
        tagType,
        note: note || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.collectionName), tagData);
      return docRef.id;
    } catch (error: unknown) {
      console.error('Error creating paragraph tag:', error);
      const message = (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Unknown error';
      throw new Error(`Failed to create paragraph tag: ${message}`);
    }
  }

  async getDocumentTags(documentId: string, userId: string): Promise<ParagraphTag[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('documentId', '==', documentId),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const tags: ParagraphTag[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as ParagraphTagData;
        tags.push({
          id: doc.id,
          documentId: data.documentId,
          userId: data.userId,
          paragraphIndex: data.paragraphIndex,
          startIndex: data.startIndex,
          endIndex: data.endIndex,
          text: data.text,
          tagType: data.tagType,
          note: data.note || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      // Sort by paragraph index
      tags.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
      return tags;
    } catch (error: unknown) {
      console.error('Error getting document tags:', error);
      const message = (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Unknown error';
      throw new Error(`Failed to get document tags: ${message}`);
    }
  }

  async updateTag(
    tagId: string,
    updates: {
      tagType?: 'needs-review' | 'done';
      note?: string;
      text?: string;
      startIndex?: number;
      endIndex?: number;
    }
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, tagId);
      
      const updateData: Partial<Pick<ParagraphTag, 'tagType' | 'note' | 'text' | 'startIndex' | 'endIndex'>> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(docRef, updateData);
    } catch (error: unknown) {
      console.error('Error updating paragraph tag:', error);
      throw new Error('Failed to update paragraph tag');
    }
  }

  async deleteTag(tagId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, tagId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting paragraph tag:', error);
      throw new Error('Failed to delete paragraph tag');
    }
  }

  async getTagByParagraph(
    documentId: string, 
    userId: string, 
    paragraphIndex: number
  ): Promise<ParagraphTag | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        where('paragraphIndex', '==', paragraphIndex)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data() as ParagraphTagData;
      
      return {
        id: doc.id,
        documentId: data.documentId,
        userId: data.userId,
        paragraphIndex: data.paragraphIndex,
        startIndex: data.startIndex,
        endIndex: data.endIndex,
        text: data.text,
        tagType: data.tagType,
        note: data.note,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting tag by paragraph:', error);
      throw new Error('Failed to get tag by paragraph');
    }
  }

  // Helper method to extract paragraphs from content
  extractParagraphs(content: string): Array<{ text: string; startIndex: number; endIndex: number }> {
    if (!content.trim()) return [];
    
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const result: Array<{ text: string; startIndex: number; endIndex: number }> = [];
    
    // track index during scanning if needed in future
    let searchIndex = 0;
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (trimmedParagraph) {
        // Find the actual position of this paragraph in the original content
        const startIndex = content.indexOf(trimmedParagraph, searchIndex);
        if (startIndex !== -1) {
          const endIndex = startIndex + trimmedParagraph.length;
          result.push({
            text: trimmedParagraph,
            startIndex,
            endIndex
          });
          searchIndex = endIndex;
        }
      }
    }
    
    return result;
  }

  // Validate and clean up tags when content changes
  async validateTags(
    documentId: string, 
    userId: string, 
    newContent: string
  ): Promise<{ validTags: ParagraphTag[]; removedTagIds: string[] }> {
    try {
      const existingTags = await this.getDocumentTags(documentId, userId);
      const currentParagraphs = this.extractParagraphs(newContent);
      
      const validTags: ParagraphTag[] = [];
      const removedTagIds: string[] = [];
      
      for (const tag of existingTags) {
        // Check if the paragraph still exists at the expected index
        if (tag.paragraphIndex < currentParagraphs.length) {
          const currentParagraph = currentParagraphs[tag.paragraphIndex];
          
          // If the text matches or is very similar, keep the tag
          if (this.textSimilarity(tag.text, currentParagraph.text) > 0.8) {
            // Update the indices if they've changed
            if (tag.startIndex !== currentParagraph.startIndex || 
                tag.endIndex !== currentParagraph.endIndex) {
              await this.updateTag(tag.id, {
                startIndex: currentParagraph.startIndex,
                endIndex: currentParagraph.endIndex,
                text: currentParagraph.text
              });
              
              validTags.push({
                ...tag,
                startIndex: currentParagraph.startIndex,
                endIndex: currentParagraph.endIndex,
                text: currentParagraph.text
              });
            } else {
              validTags.push(tag);
            }
          } else {
            // Paragraph has changed significantly, remove the tag
            await this.deleteTag(tag.id);
            removedTagIds.push(tag.id);
          }
        } else {
          // Paragraph no longer exists, remove the tag
          await this.deleteTag(tag.id);
          removedTagIds.push(tag.id);
        }
      }
      
      return { validTags, removedTagIds };
    } catch (error) {
      console.error('Error validating tags:', error);
      throw new Error('Failed to validate tags');
    }
  }

  private textSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }


}

export const paragraphTagService = new ParagraphTagService(); 