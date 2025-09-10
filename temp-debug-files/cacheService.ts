import { collection, doc, getDoc, setDoc, deleteDoc, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ContextWindow } from './contentAnalysisService';

// Cache configuration
const CACHE_TTL_HOURS = 24; // Cache expires after 24 hours
const MAX_CACHE_SIZE = 1000; // Maximum number of cached entries per user
const CLEANUP_BATCH_SIZE = 50; // Number of entries to cleanup at once

export interface CacheEntry {
  id: string;
  contentHash: string;
  analysis: any;
  metadata: {
    userId: string;
    documentId?: string;
    contextType: 'full' | 'contextWindow';
    tokenCount: number;
    paragraphCount: number;
    writingGoalsHash?: string;
  };
  createdAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;
  expiresAt: Timestamp;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  tokensSaved: number;
  avgAccessCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export const cacheService = {
  /**
   * Generate a deterministic hash for content and context
   */
  generateContentHash(
    content: string | ContextWindow[], 
    writingGoals?: any,
    contextType: 'full' | 'contextWindow' = 'full'
  ): string {
    let contentStr: string;
    
    if (Array.isArray(content)) {
      // For context window, create a stable hash from the content
      contentStr = content
        .map(w => `${w.index}:${w.isChanged ? 'C' : 'R'}:${w.text}`)
        .join('|');
    } else {
      contentStr = content;
    }
    
    // Create a comprehensive hash including writing goals
    const hashData = {
      content: contentStr,
      contextType,
      goals: writingGoals ? {
        academicLevel: writingGoals.academicLevel,
        assignmentType: writingGoals.assignmentType,
        grammarStrictness: writingGoals.grammarStrictness,
        vocabularyLevel: writingGoals.vocabularyLevel,
        toneRecommendation: writingGoals.toneRecommendation,
        customInstructions: writingGoals.customInstructions
      } : null
    };
    
    return this.simpleHash(JSON.stringify(hashData));
  },

  /**
   * Generate writing goals hash for cache key optimization
   */
  generateWritingGoalsHash(writingGoals?: any): string {
    if (!writingGoals) return 'default';
    
    const goalData = {
      academicLevel: writingGoals.academicLevel || 'high-school',
      assignmentType: writingGoals.assignmentType || 'essay',
      grammarStrictness: writingGoals.grammarStrictness || 'moderate',
      vocabularyLevel: writingGoals.vocabularyLevel || 'intermediate',
      toneRecommendation: writingGoals.toneRecommendation || 'formal',
      customInstructions: writingGoals.customInstructions || ''
    };
    
    return this.simpleHash(JSON.stringify(goalData));
  },

  /**
   * Check if cached analysis exists and is valid
   */
  async getCachedAnalysis(
    contentHash: string, 
    userId: string
  ): Promise<{ analysis: any; metadata: any } | null> {
    try {
      const cacheRef = doc(db, 'analysisCache', `${userId}_${contentHash}`);
      const cacheDoc = await getDoc(cacheRef);
      
      if (!cacheDoc.exists()) {
        console.log('🔍 Cache miss: Entry not found');
        return null;
      }
      
      const cacheData = cacheDoc.data() as CacheEntry;
      const now = new Date();
      
      // Check if cache entry has expired
      if (cacheData.expiresAt.toDate() < now) {
        console.log('⏰ Cache miss: Entry expired, cleaning up');
        await deleteDoc(cacheRef);
        return null;
      }
      
      // Update access statistics
      await setDoc(cacheRef, {
        ...cacheData,
        lastAccessedAt: Timestamp.now(),
        accessCount: cacheData.accessCount + 1
      }, { merge: true });
      
      console.log('✅ Cache hit:', {
        contentHash: contentHash.substring(0, 8) + '...',
        accessCount: cacheData.accessCount + 1,
        age: Math.round((now.getTime() - cacheData.createdAt.toDate().getTime()) / (1000 * 60)) + 'min',
        tokenCount: cacheData.metadata.tokenCount
      });
      
      return {
        analysis: cacheData.analysis,
        metadata: {
          ...cacheData.metadata,
          cacheHit: true,
          accessCount: cacheData.accessCount + 1,
          cacheAge: now.getTime() - cacheData.createdAt.toDate().getTime()
        }
      };
      
    } catch (error) {
      console.error('❌ Error checking cache:', error);
      return null;
    }
  },

  /**
   * Store analysis results in cache
   */
  async setCachedAnalysis(
    contentHash: string,
    userId: string,
    analysis: any,
    metadata: {
      documentId?: string;
      contextType: 'full' | 'contextWindow';
      tokenCount: number;
      paragraphCount: number;
      writingGoalsHash?: string;
    }
  ): Promise<void> {
    try {
      const now = Timestamp.now();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);
      
      const cacheEntry: CacheEntry = {
        id: `${userId}_${contentHash}`,
        contentHash,
        analysis,
        metadata: {
          ...metadata,
          userId
        },
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        expiresAt: Timestamp.fromDate(expiresAt)
      };
      
      const cacheRef = doc(db, 'analysisCache', cacheEntry.id);
      await setDoc(cacheRef, cacheEntry);
      
      console.log('💾 Cached analysis:', {
        contentHash: contentHash.substring(0, 8) + '...',
        contextType: metadata.contextType,
        tokenCount: metadata.tokenCount,
        expiresIn: CACHE_TTL_HOURS + 'h'
      });
      
      // Check if we need to cleanup old entries
      await this.cleanupOldEntries(userId);
      
    } catch (error) {
      console.error('❌ Error setting cache:', error);
      throw error;
    }
  },

  /**
   * Clean up old cache entries to prevent unlimited growth
   */
  async cleanupOldEntries(userId: string): Promise<void> {
    try {
      // Get total cache entries for this user
      const userCacheQuery = query(
        collection(db, 'analysisCache'),
        where('metadata.userId', '==', userId)
      );
      
      const snapshot = await getDocs(userCacheQuery);
      
      if (snapshot.size <= MAX_CACHE_SIZE) {
        return; // No cleanup needed
      }
      
      // Get oldest entries to delete
      const entries = snapshot.docs
        .map(doc => ({ docId: doc.id, ...doc.data() as CacheEntry }))
        .sort((a, b) => a.lastAccessedAt.toMillis() - b.lastAccessedAt.toMillis());
      
      const entriesToDelete = entries.slice(0, snapshot.size - MAX_CACHE_SIZE + CLEANUP_BATCH_SIZE);
      
      console.log(`🧹 Cleaning up ${entriesToDelete.length} old cache entries`);
      
      // Delete old entries in batches
      const deletePromises = entriesToDelete.map(entry => 
        deleteDoc(doc(db, 'analysisCache', entry.docId))
      );
      
      await Promise.all(deletePromises);
      
    } catch (error) {
      console.error('❌ Error cleaning up cache:', error);
      // Don't throw - cleanup failures shouldn't break the main functionality
    }
  },

  /**
   * Get cache statistics for performance monitoring
   */
  async getCacheStats(userId: string): Promise<CacheStats> {
    try {
      const userCacheQuery = query(
        collection(db, 'analysisCache'),
        where('metadata.userId', '==', userId)
      );
      
      const snapshot = await getDocs(userCacheQuery);
      const entries = snapshot.docs.map(doc => doc.data() as CacheEntry);
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          hitRate: 0,
          tokensSaved: 0,
          avgAccessCount: 0
        };
      }
      
      const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
      const totalTokens = entries.reduce((sum, entry) => sum + (entry.metadata.tokenCount * entry.accessCount), 0);
      const hitEntries = entries.filter(entry => entry.accessCount > 0);
      
      const dates = entries.map(entry => entry.createdAt.toDate());
      
      return {
        totalEntries: entries.length,
        hitRate: hitEntries.length / entries.length,
        tokensSaved: totalTokens,
        avgAccessCount: totalAccess / entries.length,
        oldestEntry: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined,
        newestEntry: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined
      };
      
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return {
        totalEntries: 0,
        hitRate: 0,
        tokensSaved: 0,
        avgAccessCount: 0
      };
    }
  },

  /**
   * Clear all cache entries for a user
   */
  async clearUserCache(userId: string): Promise<void> {
    try {
      const userCacheQuery = query(
        collection(db, 'analysisCache'),
        where('metadata.userId', '==', userId)
      );
      
      const snapshot = await getDocs(userCacheQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      console.log(`🗑️ Cleared ${snapshot.size} cache entries for user ${userId}`);
      
    } catch (error) {
      console.error('❌ Error clearing user cache:', error);
      throw error;
    }
  },

  /**
   * Clear expired cache entries across all users (maintenance function)
   */
  async clearExpiredEntries(): Promise<number> {
    try {
      const now = Timestamp.now();
      const expiredQuery = query(
        collection(db, 'analysisCache'),
        where('expiresAt', '<', now),
        limit(100) // Process in batches
      );
      
      const snapshot = await getDocs(expiredQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      console.log(`🧹 Cleared ${snapshot.size} expired cache entries`);
      return snapshot.size;
      
    } catch (error) {
      console.error('❌ Error clearing expired entries:', error);
      return 0;
    }
  },

  /**
   * Estimate cache efficiency for a given content
   */
  estimateCacheEfficiency(
    originalContent: string,
    contextWindow?: ContextWindow[]
  ): { 
    originalTokens: number; 
    cacheableTokens: number; 
    efficiency: number;
    recommendedCaching: boolean;
  } {
    const originalTokens = Math.ceil(originalContent.length / 4);
    
    let cacheableTokens: number;
    if (contextWindow && contextWindow.length > 0) {
      const contextContent = contextWindow.map(w => w.text).join(' ');
      cacheableTokens = Math.ceil(contextContent.length / 4);
    } else {
      cacheableTokens = originalTokens;
    }
    
    const efficiency = cacheableTokens / originalTokens;
    const recommendedCaching = cacheableTokens >= 100; // Only cache if substantial content
    
    return {
      originalTokens,
      cacheableTokens,
      efficiency,
      recommendedCaching
    };
  },

  /**
   * Simple hash function for browser compatibility
   */
  simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
}; 