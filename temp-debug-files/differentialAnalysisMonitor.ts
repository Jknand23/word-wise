// ✅ DIFFERENTIAL ANALYSIS - Real-time Performance Monitoring Service
// This service tracks the effectiveness of differential analysis during actual usage

import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, serverTimestamp, deleteDoc } from 'firebase/firestore';

export interface DifferentialAnalysisMetric {
  id?: string;
  userId: string;
  documentId: string;
  timestamp: Date;
  analysisType: 'full' | 'differential' | 'context-window';
  performance: {
    processingTime: number; // milliseconds
    tokenSavings?: number; // percentage (0-100)
    originalTokens?: number;
    optimizedTokens?: number;
    contextWindowSize?: number;
    changedParagraphs?: number;
    totalParagraphs?: number;
  };
  effectiveness: {
    suggestionsGenerated: number;
    cacheHit: boolean;
    errorOccurred: boolean;
    fallbackToFull?: boolean;
  };
  userExperience: {
    perceivedSpeed: 'fast' | 'medium' | 'slow';
    autoAnalysis: boolean;
    userTriggered: boolean;
  };
}

export interface PerformanceSnapshot {
  timeRange: {
    start: Date;
    end: Date;
  };
  totalAnalyses: number;
  differentialAnalysisRate: number; // percentage
  averageTokenSavings: number; // percentage
  averageProcessingTime: number; // milliseconds
  cacheHitRate: number; // percentage
  errorRate: number; // percentage
  userSatisfactionMetrics: {
    fastResponseRate: number; // percentage
    autoAnalysisSuccessRate: number; // percentage
  };
}

export const differentialAnalysisMonitor = {
  // Record a differential analysis event
  async recordAnalysisMetric(metric: Omit<DifferentialAnalysisMetric, 'id' | 'timestamp'>): Promise<void> {
    try {
      const metricWithTimestamp: DifferentialAnalysisMetric = {
        ...metric,
        timestamp: new Date()
      };

      const metricRef = doc(collection(db, 'differentialAnalysisMetrics'));
      await setDoc(metricRef, {
        ...metricWithTimestamp,
        timestamp: serverTimestamp()
      });

      // Log to console in development for immediate feedback
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 [DifferentialAnalysisMonitor] Recorded metric:', {
          analysisType: metric.analysisType,
          processingTime: metric.performance.processingTime,
          tokenSavings: metric.performance.tokenSavings,
          suggestionsGenerated: metric.effectiveness.suggestionsGenerated,
          cacheHit: metric.effectiveness.cacheHit
        });
      }
    } catch (error) {
      console.error('📊 [DifferentialAnalysisMonitor] Failed to record metric:', error);
      // Don't throw error - monitoring shouldn't break the app
    }
  },

  // Get performance snapshot for a time period
  async getPerformanceSnapshot(
    userId: string, 
    hoursBack: number = 24
  ): Promise<PerformanceSnapshot | null> {
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hoursBack);

      const q = query(
        collection(db, 'differentialAnalysisMetrics'),
        where('userId', '==', userId),
        where('timestamp', '>=', startTime),
        orderBy('timestamp', 'desc'),
        limit(100) // Limit to prevent excessive data transfer
      );

      const snapshot = await getDocs(q);
      const metrics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as DifferentialAnalysisMetric[];

      if (metrics.length === 0) {
        return null;
      }

      // Calculate performance statistics
      const totalAnalyses = metrics.length;
      const differentialAnalyses = metrics.filter(m => m.analysisType === 'differential').length;
      const cacheHits = metrics.filter(m => m.effectiveness.cacheHit).length;
      const errors = metrics.filter(m => m.effectiveness.errorOccurred).length;
      const fastResponses = metrics.filter(m => m.userExperience.perceivedSpeed === 'fast').length;
      const autoAnalysesMetrics = metrics.filter(m => m.userExperience.autoAnalysis);
      const successfulAutoAnalyses = autoAnalysesMetrics.filter(m => 
        !m.effectiveness.errorOccurred
      ).length;

      // Calculate token savings (only for analyses that have token data)
      const metricsWithTokenData = metrics.filter(m => 
        m.performance.tokenSavings !== undefined && m.performance.tokenSavings !== null
      );
      const averageTokenSavings = metricsWithTokenData.length > 0
        ? metricsWithTokenData.reduce((sum, m) => sum + (m.performance.tokenSavings || 0), 0) / metricsWithTokenData.length
        : 0;

      // Calculate average processing time
      const averageProcessingTime = metrics.reduce((sum, m) => sum + m.performance.processingTime, 0) / totalAnalyses;

      const performanceSnapshot: PerformanceSnapshot = {
        timeRange: {
          start: startTime,
          end: new Date()
        },
        totalAnalyses,
        differentialAnalysisRate: (differentialAnalyses / totalAnalyses) * 100,
        averageTokenSavings,
        averageProcessingTime,
        cacheHitRate: (cacheHits / totalAnalyses) * 100,
        errorRate: (errors / totalAnalyses) * 100,
        userSatisfactionMetrics: {
          fastResponseRate: (fastResponses / totalAnalyses) * 100,
          autoAnalysisSuccessRate: autoAnalysesMetrics.length > 0 
            ? (successfulAutoAnalyses / autoAnalysesMetrics.length) * 100 
            : 0
        }
      };

      console.log('📊 [DifferentialAnalysisMonitor] Performance snapshot:', performanceSnapshot);
      return performanceSnapshot;
    } catch (error) {
      console.error('📊 [DifferentialAnalysisMonitor] Failed to get performance snapshot:', error);
      return null;
    }
  },

  // Get detailed metrics for analysis
  async getDetailedMetrics(userId: string, daysBack: number = 7): Promise<DifferentialAnalysisMetric[]> {
    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - daysBack);

      const q = query(
        collection(db, 'differentialAnalysisMetrics'),
        where('userId', '==', userId),
        where('timestamp', '>=', startTime),
        orderBy('timestamp', 'desc'),
        limit(200)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as DifferentialAnalysisMetric[];
    } catch (error) {
      console.error('📊 [DifferentialAnalysisMonitor] Failed to get detailed metrics:', error);
      return [];
    }
  },

  // Calculate perceived speed based on processing time
  calculatePerceivedSpeed(processingTime: number): 'fast' | 'medium' | 'slow' {
    if (processingTime <= 1000) return 'fast';    // Under 1 second
    if (processingTime <= 2500) return 'medium';  // 1-2.5 seconds
    return 'slow';                                 // Over 2.5 seconds
  },

  // Helper function to create metric from suggestion response
  createMetricFromResponse(
    userId: string,
    documentId: string,
    response: any,
    startTime: number,
    isAutoAnalysis: boolean = false
  ): Omit<DifferentialAnalysisMetric, 'id' | 'timestamp'> {
    const processingTime = Date.now() - startTime;
    const perceivedSpeed = this.calculatePerceivedSpeed(processingTime);
    
    // Determine analysis type from response metadata
    let analysisType: 'full' | 'differential' | 'context-window' = 'full';
    if (response.differentialMetadata?.isDifferential) {
      analysisType = 'differential';
    } else if (response.optimizationMetadata?.usedContextWindow) {
      analysisType = 'context-window';
    }

    return {
      userId,
      documentId,
      analysisType,
      performance: {
        processingTime,
        tokenSavings: response.optimizationMetadata?.tokenSavings?.savings || 0,
        originalTokens: response.optimizationMetadata?.tokenSavings?.originalTokens,
        optimizedTokens: response.optimizationMetadata?.tokenSavings?.optimizedTokens,
        contextWindowSize: response.optimizationMetadata?.contextWindowSize || 0,
        changedParagraphs: response.differentialMetadata?.changedParagraphs || 0,
        totalParagraphs: response.differentialMetadata?.totalParagraphs || 0
      },
      effectiveness: {
        suggestionsGenerated: response.suggestions?.length || 0,
        cacheHit: response.optimizationMetadata?.cacheHit || false,
        errorOccurred: false,
        fallbackToFull: !response.differentialMetadata?.isDifferential && analysisType === 'full'
      },
      userExperience: {
        perceivedSpeed,
        autoAnalysis: isAutoAnalysis,
        userTriggered: !isAutoAnalysis
      }
    };
  },

  // Clean up old metrics (older than 30 days)
  async cleanupOldMetrics(userId: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, 'differentialAnalysisMetrics'),
        where('userId', '==', userId),
        where('timestamp', '<', thirtyDaysAgo),
        limit(50) // Delete in batches to avoid timeout
      );

      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      if (snapshot.docs.length > 0) {
        console.log(`📊 [DifferentialAnalysisMonitor] Cleaned up ${snapshot.docs.length} old metrics`);
      }
    } catch (error) {
      console.error('📊 [DifferentialAnalysisMonitor] Failed to cleanup old metrics:', error);
    }
  },

  // Generate performance report
  generatePerformanceReport(snapshot: PerformanceSnapshot): string {
    const timeRangeHours = Math.round((snapshot.timeRange.end.getTime() - snapshot.timeRange.start.getTime()) / (1000 * 60 * 60));
    
    return `
# Differential Analysis Performance Report
Generated: ${new Date().toISOString()}
Time Range: ${timeRangeHours} hours (${snapshot.timeRange.start.toISOString()} to ${snapshot.timeRange.end.toISOString()})

## Summary Metrics
- **Total Analyses**: ${snapshot.totalAnalyses}
- **Differential Analysis Usage**: ${snapshot.differentialAnalysisRate.toFixed(1)}%
- **Average Token Savings**: ${snapshot.averageTokenSavings.toFixed(1)}%
- **Average Processing Time**: ${snapshot.averageProcessingTime.toFixed(0)}ms
- **Cache Hit Rate**: ${snapshot.cacheHitRate.toFixed(1)}%
- **Error Rate**: ${snapshot.errorRate.toFixed(1)}%

## User Experience Metrics
- **Fast Response Rate**: ${snapshot.userSatisfactionMetrics.fastResponseRate.toFixed(1)}%
- **Auto-Analysis Success Rate**: ${snapshot.userSatisfactionMetrics.autoAnalysisSuccessRate.toFixed(1)}%

## Performance Assessment
${snapshot.differentialAnalysisRate >= 60 ? '✅ Excellent differential analysis adoption' : '⚠️ Consider improving differential analysis triggering'}
${snapshot.averageTokenSavings >= 50 ? '✅ Strong token cost savings' : '⚠️ Token savings below target'}
${snapshot.averageProcessingTime <= 1500 ? '✅ Fast processing times' : '⚠️ Processing times need improvement'}
${snapshot.cacheHitRate >= 30 ? '✅ Good cache utilization' : '⚠️ Cache hit rate could be improved'}
${snapshot.errorRate <= 5 ? '✅ Low error rate' : '⚠️ Error rate needs attention'}
${snapshot.userSatisfactionMetrics.fastResponseRate >= 70 ? '✅ Good user experience' : '⚠️ User experience needs improvement'}
`;
  }
};

// Export convenience functions
export const recordDifferentialAnalysisMetric = differentialAnalysisMonitor.recordAnalysisMetric;
export const getDifferentialAnalysisSnapshot = differentialAnalysisMonitor.getPerformanceSnapshot; 