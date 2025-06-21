import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  setDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Document } from './documentService';
import type { Suggestion } from '../types/suggestion';

export interface QualityMetrics {
  errorRate: number; // errors per 100 words
  suggestionDensity: number; // suggestions per 100 words
  wordCount: number;
  documentId: string;
  createdAt: Date;
}

export interface ProgressData {
  // Writing Consistency
  weeklyGoal: number;
  documentsThisWeek: number;
  currentStreak: number; // consecutive login days
  
  // Quality Improvement
  recentErrorRate: number; // average of last 5 documents
  previousErrorRate: number; // average of previous 5 documents
  trend: 'improving' | 'declining' | 'steady';
  personalBest: number; // lowest error rate ever
}

export interface UserProgressSettings {
  weeklyDocumentGoal: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginDate?: Date;
  currentStreak?: number;
}

class ProgressService {
  // Get user's progress settings
  async getUserProgressSettings(userId: string): Promise<UserProgressSettings | null> {
    try {
      const settingsRef = doc(db, 'userProgressSettings', userId);
      const settingsSnap = await getDoc(settingsRef);
      
      if (!settingsSnap.exists()) {
        return null;
      }
      
      const data = settingsSnap.data();
      return {
        userId: data.userId,
        weeklyDocumentGoal: data.weeklyDocumentGoal || 3,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastLoginDate: data.lastLoginDate?.toDate() || undefined,
        currentStreak: data.currentStreak || 0,
      };
    } catch (error) {
      console.error('Error getting user progress settings:', error);
      return null;
    }
  }

  // Set user's weekly goal
  async setWeeklyGoal(userId: string, weeklyGoal: number): Promise<void> {
    console.log('ProgressService: Setting weekly goal for user:', userId, 'to:', weeklyGoal);
    try {
      const settingsRef = doc(db, 'userProgressSettings', userId);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        // Update existing document
        console.log('ProgressService: Updating existing document');
        const _existingData = settingsSnap.data();
        await updateDoc(settingsRef, {
          weeklyDocumentGoal: weeklyGoal,
          updatedAt: serverTimestamp(),
        });
        console.log('ProgressService: Document updated successfully');
      } else {
        // Create new document
        console.log('ProgressService: Creating new document');
        await setDoc(settingsRef, {
          userId,
          weeklyDocumentGoal: weeklyGoal,
          lastLoginDate: null,
          currentStreak: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('ProgressService: Document created successfully');
      }
    } catch (error) {
      console.error('Error setting weekly goal:', error);
      throw error;
    }
  }

  // Calculate documents created this week
  async getDocumentsThisWeek(userId: string): Promise<number> {
    try {
      // Temporarily get all user documents and filter in memory to avoid index issues
      const q = query(
        collection(db, 'documents'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const startOfWeek = this.getStartOfWeek().toDate();
      
      let count = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        if (createdAt && createdAt >= startOfWeek) {
          count++;
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error getting documents this week:', error);
      return 0;
    }
  }

  // Track daily login and update streak
  async trackDailyLogin(userId: string): Promise<number> {
    try {
      const settingsRef = doc(db, 'userProgressSettings', userId);
      const settingsSnap = await getDoc(settingsRef);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      let currentStreak = 0;
      let lastLoginDate = null;
      let weeklyGoal = 3; // default
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        lastLoginDate = data.lastLoginDate?.toDate();
        currentStreak = data.currentStreak || 0;
        weeklyGoal = data.weeklyDocumentGoal || 3;
      }
      
      // Check if user already logged in today
      if (lastLoginDate) {
        const lastLogin = new Date(lastLoginDate);
        lastLogin.setHours(0, 0, 0, 0);
        
        if (lastLogin.getTime() === today.getTime()) {
          // Already logged in today, return current streak
          return currentStreak;
        }
        
        // Check if yesterday was the last login (consecutive days)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastLogin.getTime() === yesterday.getTime()) {
          // Consecutive day, increment streak
          currentStreak += 1;
        } else {
          // Gap in login, reset streak to 1 (today)
          currentStreak = 1;
        }
      } else {
        // First login ever
        currentStreak = 1;
      }
      
      // Update the settings with new login date and streak
      await setDoc(settingsRef, {
        userId,
        weeklyDocumentGoal: weeklyGoal,
        lastLoginDate: Timestamp.fromDate(today),
        currentStreak,
        createdAt: settingsSnap.exists() ? settingsSnap.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return currentStreak;
    } catch (error) {
      console.error('Error tracking daily login:', error);
      return 0;
    }
  }

  // Get current streak (without updating login)
  async getCurrentStreak(userId: string): Promise<number> {
    try {
      const settingsRef = doc(db, 'userProgressSettings', userId);
      const settingsSnap = await getDoc(settingsRef);
      
      if (!settingsSnap.exists()) {
        return 0;
      }
      
      const data = settingsSnap.data();
      const lastLoginDate = data.lastLoginDate?.toDate();
      const currentStreak = data.currentStreak || 0;
      
      if (!lastLoginDate) {
        return 0;
      }
      
      // Check if streak should be reset (no login yesterday or today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const lastLogin = new Date(lastLoginDate);
      lastLogin.setHours(0, 0, 0, 0);
      
      // If last login was today or yesterday, streak is still valid
      if (lastLogin.getTime() === today.getTime() || lastLogin.getTime() === yesterday.getTime()) {
        return currentStreak;
      } else {
        // Streak broken, reset to 0
        await setDoc(settingsRef, {
          ...data,
          currentStreak: 0,
          updatedAt: serverTimestamp(),
        });
        return 0;
      }
    } catch (error) {
      console.error('Error getting current streak:', error);
      return 0;
    }
  }

  // Calculate quality metrics for a document
  calculateQualityMetrics(document: Document, suggestions: Suggestion[]): QualityMetrics {
    const wordCount = document.wordCount || 0;
    
    if (wordCount === 0) {
      return {
        errorRate: 0,
        suggestionDensity: 0,
        wordCount: 0,
        documentId: document.id,
        createdAt: document.createdAt,
      };
    }

    // Count spelling and grammar errors
    const errors = suggestions.filter(s => 
      s.type === 'spelling' || s.type === 'grammar'
    ).length;

    // Total suggestions for density calculation
    const totalSuggestions = suggestions.length;

    return {
      errorRate: (errors / wordCount) * 100,
      suggestionDensity: (totalSuggestions / wordCount) * 100,
      wordCount,
      documentId: document.id,
      createdAt: document.createdAt,
    };
  }

  // Get recent quality metrics for trend analysis
  async getQualityTrend(userId: string): Promise<{
    recentErrorRate: number;
    previousErrorRate: number;
    trend: 'improving' | 'declining' | 'steady';
    personalBest: number;
  }> {
    try {
      // Get user's documents with quality metrics
      const documents = await this.getUserDocumentsWithMetrics(userId);
      
      if (documents.length === 0) {
        return {
          recentErrorRate: 0,
          previousErrorRate: 0,
          trend: 'steady',
          personalBest: 0,
        };
      }

      // Sort by creation date (newest first)
      documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Calculate recent average (last 5 documents)
      const recentDocs = documents.slice(0, 5);
      const recentErrorRate = recentDocs.reduce((sum, doc) => sum + doc.errorRate, 0) / recentDocs.length;

      // Calculate previous average (documents 6-10)
      const previousDocs = documents.slice(5, 10);
      const previousErrorRate = previousDocs.length > 0 
        ? previousDocs.reduce((sum, doc) => sum + doc.errorRate, 0) / previousDocs.length
        : recentErrorRate;

      // Determine trend (improvement means lower error rate)
      let trend: 'improving' | 'declining' | 'steady' = 'steady';
      const difference = Math.abs(recentErrorRate - previousErrorRate);
      
      if (difference > 0.1) { // 0.1% threshold for meaningful change
        trend = recentErrorRate < previousErrorRate ? 'improving' : 'declining';
      }

      // Find personal best (lowest error rate)
      const personalBest = Math.min(...documents.map(doc => doc.errorRate));

      return {
        recentErrorRate: Math.round(recentErrorRate * 100) / 100, // Round to 2 decimal places
        previousErrorRate: Math.round(previousErrorRate * 100) / 100,
        trend,
        personalBest: Math.round(personalBest * 100) / 100,
      };
    } catch (error) {
      console.error('Error calculating quality trend:', error);
      return {
        recentErrorRate: 0,
        previousErrorRate: 0,
        trend: 'steady',
        personalBest: 0,
      };
    }
  }

  // Get user documents with calculated quality metrics
  private async getUserDocumentsWithMetrics(userId: string): Promise<QualityMetrics[]> {
    try {
      const q = query(
        collection(db, 'documentQualityMetrics'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const metrics: QualityMetrics[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        metrics.push({
          errorRate: data.errorRate,
          suggestionDensity: data.suggestionDensity,
          wordCount: data.wordCount,
          documentId: data.documentId,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      
      return metrics;
    } catch (error) {
      console.error('Error getting user documents with metrics:', error);
      return [];
    }
  }

  // Get complete progress data for dashboard
  async getProgressData(userId: string): Promise<ProgressData> {
    try {
      const [settings, documentsThisWeek, qualityTrend, currentStreak] = await Promise.all([
        this.getUserProgressSettings(userId),
        this.getDocumentsThisWeek(userId),
        this.getQualityTrend(userId),
        this.trackDailyLogin(userId), // This will track login and return current streak
      ]);

      return {
        // Writing Consistency
        weeklyGoal: settings?.weeklyDocumentGoal || 3,
        documentsThisWeek,
        currentStreak,

        // Quality Improvement
        recentErrorRate: qualityTrend.recentErrorRate,
        previousErrorRate: qualityTrend.previousErrorRate,
        trend: qualityTrend.trend,
        personalBest: qualityTrend.personalBest,
      };
    } catch (error) {
      console.error('Error getting progress data:', error);
      // Return default values on error
      return {
        weeklyGoal: 3,
        documentsThisWeek: 0,
        currentStreak: 0,
        recentErrorRate: 0,
        previousErrorRate: 0,
        trend: 'steady',
        personalBest: 0,
      };
    }
  }

  // Utility function to get start of current week
  private getStartOfWeek(): Timestamp {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day; // Adjust for Sunday as start of week
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    return Timestamp.fromDate(startOfWeek);
  }

  // Store quality metrics for a document (called after AI analysis)
  async storeQualityMetrics(
    userId: string, 
    documentId: string, 
    metrics: Omit<QualityMetrics, 'documentId' | 'createdAt'>
  ): Promise<void> {
    try {
      const metricsRef = doc(db, 'documentQualityMetrics', `${userId}_${documentId}`);
      await setDoc(metricsRef, {
        ...metrics,
        userId,
        documentId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error storing quality metrics:', error);
    }
  }
}

export const progressService = new ProgressService(); 