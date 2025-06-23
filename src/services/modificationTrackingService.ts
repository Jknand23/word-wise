import { collection, doc, getDocs, getDoc, query, where, orderBy, setDoc, updateDoc, arrayUnion, FieldValue, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ModifiedArea, Suggestion } from '../types/suggestion';
import { contentAnalysisService } from './contentAnalysisService';
import type { ContentChange } from './contentAnalysisService';

// ✅ DIFFERENTIAL ANALYSIS - Document Change Record Type
interface DocumentChangeRecord {
  id?: string;
  documentId: string;
  userId: string;
  changes: ParagraphChange[];
  analyzed: boolean;
  createdAt: Date;
  analysisId?: string;
}

interface ParagraphChange {
  paragraphIndex: number;
  oldHash: string;
  newHash: string;
  oldText: string;
  newText: string;
  changeType: 'added' | 'modified' | 'deleted';
  timestamp: number;
}

export const modificationTrackingService = {
  // ✅ DIFFERENTIAL ANALYSIS - Track paragraph-level changes for differential analysis
  async trackParagraphChanges(
    documentId: string, 
    userId: string, 
    oldContent: string, 
    newContent: string
  ): Promise<ContentChange[]> {
    try {
      console.log('🔍 [DifferentialAnalysis] Tracking paragraph changes:', {
        documentId,
        userId,
        oldLength: oldContent.length,
        newLength: newContent.length
      });

      // Detect changed paragraphs using contentAnalysisService
      const changes = contentAnalysisService.detectChangedParagraphs(oldContent, newContent);
      
      if (changes.length === 0) {
        console.log('🔍 [DifferentialAnalysis] No paragraph changes detected');
        return [];
      }

      // Create paragraph change records
      const paragraphChanges: ParagraphChange[] = changes.map(change => ({
        paragraphIndex: change.index,
        oldHash: this.hashParagraph(change.oldText),
        newHash: this.hashParagraph(change.newText),
        oldText: change.oldText,
        newText: change.newText,
        changeType: change.type,
        timestamp: Date.now()
      }));

      // Store the change record in Firestore
      const changeRecord: DocumentChangeRecord = {
        documentId,
        userId,
        changes: paragraphChanges,
        analyzed: false,
        createdAt: new Date()
      };

      const changeRef = doc(collection(db, 'documentChanges'));
      
      console.log('🔍 [DifferentialAnalysis] About to save change record:', {
        documentId,
        userId,
        changesCount: paragraphChanges.length,
        analyzed: false
      });

      try {
        await setDoc(changeRef, {
          ...changeRecord,
          createdAt: serverTimestamp()
        });

        console.log('🔍 [DifferentialAnalysis] ✅ Change record saved to Firestore:', {
          recordId: changeRef.id,
          changesCount: changes.length,
          changeTypes: changes.map(c => c.type),
          path: changeRef.path,
          documentId: changeRecord.documentId,
          userId: changeRecord.userId
        });
      } catch (saveError) {
        console.error('🔍 [DifferentialAnalysis] ❌ FAILED to save change record:', saveError);
        throw saveError;
      }

      // Verify the record was saved by immediately querying it back
      try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for consistency
        const verifyDoc = await getDoc(changeRef);
        console.log('🔍 [DifferentialAnalysis] Record verification:', {
          exists: verifyDoc.exists(),
          docId: changeRef.id,
          data: verifyDoc.exists() ? verifyDoc.data() : null
        });
        
        if (!verifyDoc.exists()) {
          console.error('🔍 [DifferentialAnalysis] ❌ CRITICAL: Record was not saved despite success!');
        }
      } catch (verifyError) {
        console.error('🔍 [DifferentialAnalysis] Error verifying saved record:', verifyError);
      }

      return changes;
    } catch (error) {
      console.error('🔍 [DifferentialAnalysis] Error tracking paragraph changes:', error);
      // Return empty array to allow system to continue without differential tracking
      return [];
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Get unanalyzed changes for differential processing
  async getUnanalyzedChanges(documentId: string, userId: string): Promise<DocumentChangeRecord[]> {
    try {
      console.log('🔍 [DifferentialAnalysis] Getting unanalyzed changes:', { documentId, userId });

      const q = query(
        collection(db, 'documentChanges'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        where('analyzed', '==', false)
        // Temporarily removing orderBy until index builds
        // orderBy('createdAt', 'desc')
      );

      console.log('🔍 [DifferentialAnalysis] About to execute query on documentChanges collection...');
      
      const snapshot = await getDocs(q);
      
      console.log('🔍 [DifferentialAnalysis] Query executed:', {
        docsFound: snapshot.docs.length,
        isEmpty: snapshot.empty,
        size: snapshot.size
      });

      // Log all documents found (even if analyzed=true) for debugging
      const allDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
      console.log('🔍 [DifferentialAnalysis] All documents in query result:', allDocs);

      const changes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as DocumentChangeRecord[];

      console.log('🔍 [DifferentialAnalysis] Found unanalyzed changes:', {
        count: changes.length,
        totalParagraphChanges: changes.reduce((sum, change) => sum + change.changes.length, 0),
        changeDetails: changes.map(c => ({ id: c.id, analyzed: c.analyzed, documentId: c.documentId, userId: c.userId }))
      });

      return changes;
    } catch (error) {
      console.error('🔍 [DifferentialAnalysis] ❌ CRITICAL ERROR getting unanalyzed changes:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Mark changes as analyzed
  async markChangesAsAnalyzed(changeRecordIds: string[], analysisId: string): Promise<void> {
    try {
      console.log('🔍 [DifferentialAnalysis] Marking changes as analyzed:', {
        recordIds: changeRecordIds,
        analysisId
      });

      const updatePromises = changeRecordIds.map(async (recordId) => {
        const changeRef = doc(db, 'documentChanges', recordId);
        await updateDoc(changeRef, {
          analyzed: true,
          analysisId: analysisId,
          analyzedAt: serverTimestamp()
        });
      });

      await Promise.all(updatePromises);
      console.log('🔍 [DifferentialAnalysis] Successfully marked changes as analyzed');
    } catch (error) {
      console.error('🔍 [DifferentialAnalysis] Error marking changes as analyzed:', error);
      throw error;
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Clean up old change records (older than 7 days)
  async cleanupOldChangeRecords(documentId: string, userId: string): Promise<void> {
    try {  
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const q = query(
        collection(db, 'documentChanges'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        where('createdAt', '<', sevenDaysAgo)
      );

      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      if (snapshot.docs.length > 0) {
        console.log('🔍 [DifferentialAnalysis] Cleaned up old change records:', {
          deletedCount: snapshot.docs.length
        });
      }
    } catch (error) {
      console.error('🔍 [DifferentialAnalysis] Error cleaning up old change records:', error);
    }
  },

  // ✅ DIFFERENTIAL ANALYSIS - Generate hash for paragraph content
  hashParagraph(text: string): string {
    if (!text || text.trim() === '') return '';
    
    // Simple hash function for paragraph content
    let hash = 0;
    const normalizedText = text.trim().toLowerCase();
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  },

  // ✅ DIFFERENTIAL ANALYSIS - Check if document has unanalyzed changes
  async hasUnanalyzedChanges(documentId: string, userId: string): Promise<boolean> {
    try {
      console.log('🔍 [DifferentialAnalysis] Checking for unanalyzed changes:', { documentId, userId });
      const unanalyzedChanges = await this.getUnanalyzedChanges(documentId, userId);
      const hasChanges = unanalyzedChanges.length > 0;
      console.log('🔍 [DifferentialAnalysis] Has unanalyzed changes result:', {
        hasChanges,
        changesCount: unanalyzedChanges.length,
        changeIds: unanalyzedChanges.map(c => c.id)
      });
      return hasChanges;
    } catch (error) {
      console.error('🔍 [DifferentialAnalysis] Error checking unanalyzed changes:', error);
      return false;
    }
  },

  // Get previously modified areas for a document
  async getModifiedAreas(documentId: string, userId: string): Promise<ModifiedArea[]> {
    try {
      console.log(`[ModificationTracking] Attempting to fetch modified areas for doc: ${documentId}, user: ${userId}`);
      
      const q = query(
        collection(db, 'modifiedAreas'),
        where('documentId', '==', documentId),
        where('userId', '==', userId),
        orderBy('lastModified', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const areas = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        lastModified: doc.data().lastModified?.toDate(),
      })) as ModifiedArea[];
      
      console.log(`[ModificationTracking] Successfully fetched ${areas.length} modified areas`);
      return areas;
    } catch (error) {
      console.error('[ModificationTracking] Error fetching modified areas:', error);
      console.log('[ModificationTracking] Falling back to empty array - modification tracking disabled');
      
      // Return empty array so system continues to work without modification tracking
      // This means engagement suggestions won't be filtered, but at least the app works
      return [];
    }
  },

  // Track a new modification when a suggestion is accepted
  async trackModification(suggestion: Suggestion, newText: string): Promise<void> {
    // Only track clarity and engagement modifications
    if (suggestion.type !== 'clarity' && suggestion.type !== 'engagement') {
      console.log(`[ModificationTracking] Skipping tracking for ${suggestion.type} suggestion`);
      return;
    }

    console.log(`[ModificationTracking] Tracking modification for ${suggestion.type}:`, {
      suggestionId: suggestion.id,
      originalText: suggestion.originalText,
      newText: newText,
      startIndex: suggestion.startIndex,
      endIndex: suggestion.endIndex,
      documentId: suggestion.documentId,
      userId: suggestion.userId
    });

    try {
      // Check if this area was already modified
      const existingModifications = await this.getModifiedAreas(suggestion.documentId, suggestion.userId);
      console.log(`[ModificationTracking] Found ${existingModifications.length} existing modifications`);

      // Find overlapping areas of the same type
      const overlappingArea = existingModifications.find(area => {
        const overlaps = this.areasOverlap(area, {
          startIndex: suggestion.startIndex,
          endIndex: suggestion.endIndex
        });
        const sameType = area.type === suggestion.type;
        console.log(`[ModificationTracking] Checking area ${area.startIndex}-${area.endIndex} (${area.type}): overlaps=${overlaps}, sameType=${sameType}`);
        return overlaps && sameType;
      });

      if (overlappingArea) {
        // Update existing area with new iteration
        const existingAreaId = `${suggestion.documentId}_${overlappingArea.startIndex}_${overlappingArea.endIndex}`;
        const updatedAreaRef = doc(db, 'modifiedAreas', existingAreaId);
        const newIterationCount = (overlappingArea.iterationCount || 1) + 1;
        
        console.log(`[ModificationTracking] Updating existing area, iteration count: ${newIterationCount}`);
        
        await updateDoc(updatedAreaRef, {
          modifiedText: newText,
          endIndex: suggestion.startIndex + newText.length,
          iterationCount: newIterationCount,
          lastModified: new Date(),
          suggestionIds: arrayUnion(suggestion.id)
        });
      } else {
        // Create new modified area
        const modifiedAreaId = `${suggestion.documentId}_${suggestion.startIndex}_${suggestion.endIndex}`;
        const modifiedAreaRef = doc(db, 'modifiedAreas', modifiedAreaId);
        
        console.log(`[ModificationTracking] Creating new modified area with ID: ${modifiedAreaId}`);
        
        const modifiedArea: ModifiedArea & { documentId: string; userId: string } = {
          documentId: suggestion.documentId,
          userId: suggestion.userId,
          startIndex: suggestion.startIndex,
          endIndex: suggestion.startIndex + newText.length,
          type: suggestion.type as 'clarity' | 'engagement',
          originalText: suggestion.originalText,
          modifiedText: newText,
          iterationCount: 1,
          lastModified: new Date(),
          suggestionIds: [suggestion.id]
        };

        await setDoc(modifiedAreaRef, modifiedArea);
      }
      
      console.log(`[ModificationTracking] Successfully tracked modification for suggestion ${suggestion.id}`);
    } catch (error) {
      console.error('[ModificationTracking] Error tracking modification:', error);
      console.log('[ModificationTracking] Continuing without tracking - system will still work');
      
      // Don't throw error - let the system continue working without modification tracking
      // This means engagement suggestions won't be tracked, but the app won't break
    }
  },

  // Check if two areas overlap
  areasOverlap(area1: ModifiedArea, area2: Partial<ModifiedArea>): boolean {
    if (!area2.startIndex || !area2.endIndex) return false;
    
    return !(area1.endIndex <= area2.startIndex || area2.endIndex <= area1.startIndex);
  },

  // Check if an area should be excluded from new suggestions
  shouldExcludeArea(
    startIndex: number, 
    endIndex: number, 
    type: 'clarity' | 'engagement',
    modifiedAreas: ModifiedArea[],
    maxIterations?: number
  ): boolean {
    // Both ENGAGEMENT and CLARITY get only 1 iteration each
    const defaultMaxIterations = (type === 'engagement' || type === 'clarity') ? 1 : 2;
    const actualMaxIterations = maxIterations ?? defaultMaxIterations;
    
    return modifiedAreas.some(area => {
      // Check if this area overlaps and has the same type
      if (area.type === type && this.areasOverlap(area, { startIndex, endIndex })) {
        // Different cooldown periods: 3 minutes for engagement/clarity, 30 seconds for grammar
        const cooldownPeriod = (type === 'engagement' || type === 'clarity') ? 180000 : 30000; // 3 minutes vs 30 seconds
        const recentlyModified = new Date().getTime() - area.lastModified.getTime() < cooldownPeriod;
        const overLimit = (area.iterationCount || 1) >= actualMaxIterations;
        
        if (recentlyModified || overLimit) {
          console.log(`[ModificationTracking] Excluding ${type} area: overLimit=${overLimit} (${area.iterationCount}/${actualMaxIterations}), recentlyModified=${recentlyModified} (${cooldownPeriod/60000}min cooldown)`);
          return true;
        }
      }
      return false;
    });
  },

  // Clean up old modified areas (older than 30 days)
  async cleanupOldModifications(documentId: string, userId: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const modifiedAreas = await this.getModifiedAreas(documentId, userId);
      const oldAreas = modifiedAreas.filter(area => area.lastModified < thirtyDaysAgo);

      for (const area of oldAreas) {
        const areaId = `${documentId}_${area.startIndex}_${area.endIndex}`;
        const areaRef = doc(db, 'modifiedAreas', areaId);
        await updateDoc(areaRef, {
          iterationCount: 0 // Reset iteration count instead of deleting
        });
      }
    } catch (error) {
      console.error('Error cleaning up old modifications:', error);
    }
  }
}; 