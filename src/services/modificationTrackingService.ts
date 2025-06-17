import { collection, doc, getDocs, query, where, orderBy, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ModifiedArea, Suggestion } from '../types/suggestion';

export const modificationTrackingService = {
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