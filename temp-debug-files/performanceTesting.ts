// Performance Testing Utilities for Context Window Management
// Only active in development mode

export interface PerformanceMetrics {
  totalTime: number;
  usedContextWindow: boolean;
  tokenSavings: {
    originalTokens: number;
    optimizedTokens: number;
    savings: number;
  } | null;
  contextWindowSize: number;
  suggestionCount: number;
  timestamp: string;
}

export interface TestScenario {
  name: string;
  description: string;
  documentContent: string;
  modifications: string[];
  expectedOptimization: boolean;
}

export class ContextWindowPerformanceTester {
  private metrics: PerformanceMetrics[] = [];
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor() {
    if (this.isDevelopment) {
      // Make testing utilities available globally in development
      (window as any).cwTester = this;
    }
  }

  /**
   * Measure performance of a suggestion request
   */
  async measureSuggestionPerformance(
    suggestionService: any,
    requestData: any
  ): Promise<{ response: any; metrics: PerformanceMetrics }> {
    if (!this.isDevelopment) {
      // In production, just make the request without measurement
      const response = await suggestionService.requestSuggestions(requestData);
      return { response, metrics: {} as PerformanceMetrics };
    }

    const startTime = performance.now();
    
    console.log('🧪 Starting performance measurement...');
    
    try {
      const response = await suggestionService.requestSuggestions(requestData);
      const endTime = performance.now();
      
      const metrics: PerformanceMetrics = {
        totalTime: endTime - startTime,
        usedContextWindow: response.optimizationMetadata?.usedContextWindow || false,
        tokenSavings: response.optimizationMetadata?.tokenSavings || null,
        contextWindowSize: response.optimizationMetadata?.contextWindowSize || 0,
        suggestionCount: response.suggestions?.length || 0,
        timestamp: new Date().toISOString()
      };

      this.metrics.push(metrics);
      this.logPerformanceResults(metrics);
      
      return { response, metrics };
    } catch (error) {
      console.error('❌ Performance test failed:', error);
      throw error;
    }
  }

  /**
   * Log performance results to console
   */
  private logPerformanceResults(metrics: PerformanceMetrics) {
    console.log('📊 Performance Test Results:', {
      '⏱️ Response Time': `${metrics.totalTime.toFixed(0)}ms`,
      '🎯 Used Context Window': metrics.usedContextWindow ? '✅ Yes' : '❌ No',
      '💾 Context Window Size': metrics.contextWindowSize,
      '💡 Suggestions Generated': metrics.suggestionCount,
      '💰 Token Savings': metrics.tokenSavings ? 
        `${metrics.tokenSavings.savings}% (${metrics.tokenSavings.originalTokens} → ${metrics.tokenSavings.optimizedTokens})` : 
        'None'
    });

    if (metrics.usedContextWindow && metrics.tokenSavings) {
      const savingsEmoji = metrics.tokenSavings.savings >= 50 ? '🎉' : 
                          metrics.tokenSavings.savings >= 25 ? '👍' : '⚠️';
      console.log(`${savingsEmoji} Token Optimization: ${metrics.tokenSavings.savings}% savings achieved!`);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalTests: number;
    averageResponseTime: number;
    optimizationUsageRate: number;
    averageTokenSavings: number;
    successRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalTests: 0,
        averageResponseTime: 0,
        optimizationUsageRate: 0,
        averageTokenSavings: 0,
        successRate: 0
      };
    }

    const optimizedRequests = this.metrics.filter(m => m.usedContextWindow);
    const totalSavings = optimizedRequests
      .filter(m => m.tokenSavings)
      .reduce((sum, m) => sum + (m.tokenSavings?.savings || 0), 0);

    return {
      totalTests: this.metrics.length,
      averageResponseTime: this.metrics.reduce((sum, m) => sum + m.totalTime, 0) / this.metrics.length,
      optimizationUsageRate: (optimizedRequests.length / this.metrics.length) * 100,
      averageTokenSavings: optimizedRequests.length > 0 ? totalSavings / optimizedRequests.length : 0,
      successRate: 100 // All recorded metrics are successful requests
    };
  }

  /**
   * Print detailed performance report
   */
  printPerformanceReport() {
    if (!this.isDevelopment) return;

    const summary = this.getPerformanceSummary();
    
    console.log('\n📈 CONTEXT WINDOW PERFORMANCE REPORT');
    console.log('=====================================');
    console.log(`🧪 Total Tests: ${summary.totalTests}`);
    console.log(`⏱️ Average Response Time: ${summary.averageResponseTime.toFixed(0)}ms`);
    console.log(`🎯 Optimization Usage Rate: ${summary.optimizationUsageRate.toFixed(1)}%`);
    console.log(`💰 Average Token Savings: ${summary.averageTokenSavings.toFixed(1)}%`);
    console.log(`✅ Success Rate: ${summary.successRate}%`);
    
    if (summary.optimizationUsageRate >= 60) {
      console.log('🎉 EXCELLENT: High optimization usage rate!');
    } else if (summary.optimizationUsageRate >= 30) {
      console.log('👍 GOOD: Moderate optimization usage');
    } else {
      console.log('⚠️ LOW: Consider reviewing optimization criteria');
    }

    if (summary.averageTokenSavings >= 50) {
      console.log('🎯 TARGET ACHIEVED: 50%+ token savings!');
    } else if (summary.averageTokenSavings >= 25) {
      console.log('📈 PROGRESS: Good token savings achieved');
    } else if (summary.totalTests > 0) {
      console.log('📊 REVIEW NEEDED: Token savings below target');
    }
  }

  /**
   * Clear performance metrics
   */
  clearMetrics() {
    this.metrics = [];
    console.log('🗑️ Performance metrics cleared');
  }

  /**
   * Generate test scenarios for different document types
   */
  getTestScenarios(): TestScenario[] {
    return [
      {
        name: 'Small Essay Edit',
        description: 'Test optimization with small paragraph modification',
        documentContent: `Introduction paragraph with thesis statement.

First body paragraph with supporting evidence and analysis.

Second body paragraph with additional evidence and analysis.

Conclusion paragraph that summarizes the main points.`,
        modifications: [
          'First body paragraph with ENHANCED supporting evidence and detailed analysis.',
        ],
        expectedOptimization: true
      },
      {
        name: 'Large Document Edit',
        description: 'Test optimization with single paragraph change in large document',
        documentContent: `This is paragraph 1 with introduction content.

This is paragraph 2 with first main point.

This is paragraph 3 with supporting evidence.

This is paragraph 4 with analysis.

This is paragraph 5 with counter-argument.

This is paragraph 6 with refutation.

This is paragraph 7 with additional evidence.

This is paragraph 8 with final analysis.

This is paragraph 9 with conclusion.

This is paragraph 10 with final thoughts.`,
        modifications: [
          'This is paragraph 5 with REVISED counter-argument and new perspective.',
        ],
        expectedOptimization: true
      },
      {
        name: 'New Document',
        description: 'Test full analysis for completely new document',
        documentContent: `This is a brand new essay about artificial intelligence.

AI has revolutionized many aspects of modern life.

Machine learning algorithms can process vast amounts of data.

The implications for the future are significant.`,
        modifications: [],
        expectedOptimization: false
      },
      {
        name: 'Major Rewrite',
        description: 'Test fallback to full analysis for major changes',
        documentContent: `Original essay about climate change.

Climate change affects global temperatures.

Rising sea levels threaten coastal cities.

We need immediate action.`,
        modifications: [
          'Completely rewritten essay about technology instead.',
          'Technology has transformed communication methods.',
          'Social media platforms connect people worldwide.',
          'Digital innovation drives economic growth.',
        ],
        expectedOptimization: false
      }
    ];
  }

  /**
   * Run automated test scenario
   */
  async runTestScenario(
    scenario: TestScenario,
    suggestionService: any,
    documentId: string,
    userId: string
  ): Promise<void> {
    if (!this.isDevelopment) return;

    console.log(`\n🧪 Running Test Scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log(`🎯 Expected Optimization: ${scenario.expectedOptimization ? 'Yes' : 'No'}`);

    const content = scenario.modifications.length > 0 ? 
      scenario.modifications.join('\n\n') : 
      scenario.documentContent;

    try {
      const { metrics } = await this.measureSuggestionPerformance(suggestionService, {
        documentId,
        content,
        userId
      });

      const optimizationMatch = metrics.usedContextWindow === scenario.expectedOptimization;
      console.log(`${optimizationMatch ? '✅' : '⚠️'} Optimization Decision: ${optimizationMatch ? 'As Expected' : 'Unexpected'}`);
      
    } catch (error) {
      console.error(`❌ Test scenario "${scenario.name}" failed:`, error);
    }
  }

  /**
   * Run all test scenarios
   */
  async runAllTestScenarios(
    suggestionService: any,
    documentId: string,
    userId: string
  ): Promise<void> {
    if (!this.isDevelopment) return;

    console.log('\n🚀 Starting Automated Performance Test Suite');
    console.log('===========================================');

    const scenarios = this.getTestScenarios();
    
    for (const scenario of scenarios) {
      await this.runTestScenario(scenario, suggestionService, documentId, userId);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printPerformanceReport();
  }
}

// Create global instance for development
export const performanceTester = new ContextWindowPerformanceTester();

// Development-only console commands
if (process.env.NODE_ENV === 'development') {
  console.log('🧪 Context Window Performance Testing Available!');
  console.log('Commands:');
  console.log('  cwTester.printPerformanceReport() - Show performance summary');
  console.log('  cwTester.clearMetrics() - Clear test data');
  console.log('  cwTester.getTestScenarios() - View test scenarios');
} 