import { cacheService } from '../services/cacheService';
import { contentAnalysisService } from '../services/contentAnalysisService';
import { suggestionService } from '../services/suggestionService';

// Test data configurations
const TEST_CONTENT_SAMPLES = [
  {
    id: 'short-essay',
    title: 'Short Essay',
    content: `Education is the foundation of society. It shapes minds and builds futures. Every student deserves access to quality education.`,
    expectedParagraphs: 1,
    expectedTokens: 30
  },
  {
    id: 'medium-essay',
    title: 'Medium Essay',
    content: `The importance of environmental conservation cannot be overstated in today's world. Climate change, pollution, and resource depletion threaten our planet's future.

We must take immediate action to protect our environment. This includes reducing carbon emissions, conserving water, and protecting biodiversity.`,
    expectedParagraphs: 2,
    expectedTokens: 60
  }
];

const WRITING_GOALS_VARIATIONS = [
  {
    id: 'high-school-essay',
    academicLevel: 'high-school' as const,
    assignmentType: 'essay' as const,
    grammarStrictness: 'moderate' as const,
    vocabularyLevel: 'intermediate' as const,
    toneRecommendation: 'formal' as const
  }
];

export interface CachePerformanceTestResult {
  testId: string;
  testName: string;
  timestamp: Date;
  contentSample: string;
  writingGoals: any;
  testType: 'cache-miss' | 'cache-hit' | 'context-window' | 'full-analysis';
  responseTime: number;
  tokenUsage: {
    original: number;
    processed: number;
    saved: number;
    savingsPercentage: number;
  };
  cacheHit: boolean;
  cacheKey: string;
  cacheEfficiency: number;
  suggestionsCount: number;
  analysisType: 'full' | 'contextWindow';
  usedContextWindow: boolean;
  contextWindowSize: number;
  testDuration: number;
  errorOccurred: boolean;
  errorMessage?: string;
}

export interface CachePerformanceTestSuite {
  results: CachePerformanceTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageResponseTime: number;
    averageCacheHitRate: number;
    totalTokensSaved: number;
    totalSavingsPercentage: number;
    testDuration: number;
  };
}

export const cachePerformanceTesting = {
  async runBasicCacheTest(userId: string): Promise<CachePerformanceTestSuite> {
    const startTime = Date.now();
    const results: CachePerformanceTestResult[] = [];
    
    console.log('🧪 Starting Basic Cache Performance Test...');
    
    try {
      // Clear cache before testing
      await cacheService.clearUserCache(userId);
      console.log('🧹 Cache cleared for clean testing environment');
      
      // Test cache miss
      const content = TEST_CONTENT_SAMPLES[0];
      const goals = WRITING_GOALS_VARIATIONS[0];
      
      const result1 = await this.testCacheMiss(userId, content, goals, 'basic-cache-miss');
      results.push(result1);
      
      // Test cache hit
      const result2 = await this.testCacheHit(userId, content, goals, 'basic-cache-hit');
      results.push(result2);
      
    } catch (error) {
      console.error('❌ Basic cache test failed:', error);
    }
    
    const totalDuration = Date.now() - startTime;
    const summary = this.generateTestSummary(results, totalDuration);
    
    console.log('🎯 Basic Cache Test Complete!');
    console.log('📈 Summary:', summary);
    
    return { results, summary };
  },

  async testCacheMiss(userId: string, contentSample: any, writingGoals: any, testId: string): Promise<CachePerformanceTestResult> {
    const testStartTime = Date.now();
    
    try {
      console.log(`  🔍 Testing cache miss: ${contentSample.title}`);
      
      const analysisStartTime = Date.now();
      
      const response = await suggestionService.requestSuggestions({
        documentId: `test-doc-${testId}`,
        content: contentSample.content,
        userId,
        writingGoals
      });
      
      const responseTime = Date.now() - analysisStartTime;
      
      const cacheKey = cacheService.generateContentHash(
        contentSample.content,
        writingGoals,
        'full'
      );
      
      return {
        testId,
        testName: `Cache Miss: ${contentSample.title}`,
        timestamp: new Date(),
        contentSample: contentSample.id,
        writingGoals,
        testType: 'cache-miss',
        responseTime,
        tokenUsage: {
          original: contentSample.expectedTokens,
          processed: contentSample.expectedTokens,
          saved: 0,
          savingsPercentage: 0
        },
        cacheHit: false,
        cacheKey,
        cacheEfficiency: 0,
        suggestionsCount: response.suggestions?.length || 0,
        analysisType: 'full',
        usedContextWindow: response.optimizationMetadata?.usedContextWindow || false,
        contextWindowSize: response.optimizationMetadata?.contextWindowSize || 0,
        testDuration: Date.now() - testStartTime,
        errorOccurred: false
      };
      
    } catch (error) {
      console.error(`❌ Cache miss test failed for ${testId}:`, error);
      return this.createErrorResult(testId, contentSample, writingGoals, 'cache-miss', testStartTime, error);
    }
  },

  async testCacheHit(userId: string, contentSample: any, writingGoals: any, testId: string): Promise<CachePerformanceTestResult> {
    const testStartTime = Date.now();
    
    try {
      console.log(`  ⚡ Testing cache hit: ${contentSample.title}`);
      
      const analysisStartTime = Date.now();
      
      const response = await suggestionService.requestSuggestions({
        documentId: `test-doc-${testId}`,
        content: contentSample.content,
        userId,
        writingGoals
      });
      
      const responseTime = Date.now() - analysisStartTime;
      
      const cacheKey = cacheService.generateContentHash(
        contentSample.content,
        writingGoals,
        'full'
      );
      
      const cacheHit = response.optimizationMetadata?.cacheHit || false;
      const tokensSaved = cacheHit ? contentSample.expectedTokens : 0;
      const savingsPercentage = cacheHit ? 100 : 0;
      
      return {
        testId,
        testName: `Cache Hit: ${contentSample.title}`,
        timestamp: new Date(),
        contentSample: contentSample.id,
        writingGoals,
        testType: 'cache-hit',
        responseTime,
        tokenUsage: {
          original: contentSample.expectedTokens,
          processed: cacheHit ? 0 : contentSample.expectedTokens,
          saved: tokensSaved,
          savingsPercentage
        },
        cacheHit,
        cacheKey,
        cacheEfficiency: savingsPercentage / 100,
        suggestionsCount: response.suggestions?.length || 0,
        analysisType: 'full',
        usedContextWindow: response.optimizationMetadata?.usedContextWindow || false,
        contextWindowSize: response.optimizationMetadata?.contextWindowSize || 0,
        testDuration: Date.now() - testStartTime,
        errorOccurred: false
      };
      
    } catch (error) {
      console.error(`❌ Cache hit test failed for ${testId}:`, error);
      return this.createErrorResult(testId, contentSample, writingGoals, 'cache-hit', testStartTime, error);
    }
  },

  createErrorResult(testId: string, contentSample: any, writingGoals: any, testType: string, testStartTime: number, error: any): CachePerformanceTestResult {
    return {
      testId,
      testName: `${testType}: ${contentSample.title}`,
      timestamp: new Date(),
      contentSample: contentSample.id,
      writingGoals,
      testType: testType as any,
      responseTime: 0,
      tokenUsage: { original: 0, processed: 0, saved: 0, savingsPercentage: 0 },
      cacheHit: false,
      cacheKey: '',
      cacheEfficiency: 0,
      suggestionsCount: 0,
      analysisType: 'full',
      usedContextWindow: false,
      contextWindowSize: 0,
      testDuration: Date.now() - testStartTime,
      errorOccurred: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  },

  generateTestSummary(results: CachePerformanceTestResult[], testDuration: number) {
    const totalTests = results.length;
    const passedTests = results.filter(r => !r.errorOccurred).length;
    const failedTests = totalTests - passedTests;
    
    const validResults = results.filter(r => !r.errorOccurred);
    const averageResponseTime = validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length 
      : 0;
    
    const cacheHits = validResults.filter(r => r.cacheHit).length;
    const averageCacheHitRate = validResults.length > 0 ? cacheHits / validResults.length : 0;
    
    const totalTokensSaved = validResults.reduce((sum, r) => sum + r.tokenUsage.saved, 0);
    const totalOriginalTokens = validResults.reduce((sum, r) => sum + r.tokenUsage.original, 0);
    const totalSavingsPercentage = totalOriginalTokens > 0 
      ? (totalTokensSaved / totalOriginalTokens) * 100 
      : 0;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      averageResponseTime: Math.round(averageResponseTime),
      averageCacheHitRate: Math.round(averageCacheHitRate * 100) / 100,
      totalTokensSaved,
      totalSavingsPercentage: Math.round(totalSavingsPercentage * 100) / 100,
      testDuration
    };
  }
}; 