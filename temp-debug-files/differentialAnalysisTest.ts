// ✅ DIFFERENTIAL ANALYSIS - Comprehensive Test Utility
// This file demonstrates and tests the differential analysis functionality

import { suggestionService } from '../services/suggestionService';
import { modificationTrackingService } from '../services/modificationTrackingService';
import { contentAnalysisService } from '../services/contentAnalysisService';

export interface DifferentialAnalysisTestResult {
  scenario: string;
  testData: {
    originalContent: string;
    modifiedContent: string;
    changeType: string;
    changeDescription: string;
  };
  results: {
    usedDifferentialAnalysis: boolean;
    changedParagraphs: number;
    totalParagraphs: number;
    tokenSavings: number; // percentage
    processingTime: number;
    suggestionsCount: number;
    errorRate?: number;
  };
  performance: {
    estimatedTokenSavings: string;
    analysisType: 'full' | 'differential';
    contextWindowSize: number;
  };
}

export const differentialAnalysisTestSuite = {
  // Test Scenario 1: Minor text edits (should use differential analysis)
  async testMinorEdits(documentId: string, userId: string): Promise<DifferentialAnalysisTestResult> {
    const originalContent = `
      Introduction:
      Writing is an essential skill that students must develop throughout their academic careers. This essay will explore the importance of clear communication in academic settings and its impact on student success.

      Literature Review:
      Numerous studies have examined the relationship between writing proficiency and academic achievement. Research conducted by Smith et al. (2019) demonstrated that students with strong writing skills performed significantly better across all subject areas.

      Historical Context:
      The evolution of writing instruction has transformed dramatically over the past century. Traditional approaches focused primarily on grammar and mechanics, while contemporary methods emphasize process-oriented strategies and authentic communication.

      Body Paragraph 1:
      Clear writing helps students express their ideas effectively. When students write clearly, their professors can understand their arguments better. This improved communication leads to better grades and enhanced learning outcomes.

      Body Paragraph 2:
      Furthermore, good writing skills are transferable to professional environments. Many careers require strong written communication skills, including business, law, medicine, and education. Employers consistently rank writing ability among the most important skills for career advancement.

      Body Paragraph 3:
      Digital communication has added new dimensions to writing requirements. Students must now master various formats including emails, social media posts, blogs, and multimedia presentations. Each medium requires different strategies and conventions.

      Body Paragraph 4:
      Writing also serves as a tool for critical thinking development. The process of organizing thoughts into coherent written arguments helps students develop analytical and reasoning skills that benefit them across all academic disciplines.

      Counterarguments:
      Some critics argue that excessive focus on writing detracts from content mastery in technical fields. However, research suggests that writing enhances rather than competes with content learning by providing opportunities for deeper engagement with material.

      Future Implications:
      As artificial intelligence tools become more prevalent, the nature of writing instruction may evolve. However, the fundamental skills of clear thinking and effective communication will remain essential for student success.

      Conclusion:
      In conclusion, developing strong writing skills is crucial for academic and professional success. Educational institutions must continue to prioritize writing instruction across all disciplines to prepare students for future challenges.
    `.trim();

    const modifiedContent = originalContent.replace(
      'their professors can understand their arguments better',
      'their instructors can comprehend their arguments more effectively'
    );

    return await differentialAnalysisTestSuite.runDifferentialAnalysisTest({
      scenario: 'Minor Text Edits',
      documentId,
      userId,
      originalContent,
      modifiedContent,
      changeType: 'word_replacement',
      changeDescription: 'Replaced "professors" with "instructors" and improved word choice'
    });
  },

  // Test Scenario 2: New paragraph addition (should use differential analysis)
  async testParagraphAddition(documentId: string, userId: string): Promise<DifferentialAnalysisTestResult> {
    const originalContent = `
      Introduction:
      Writing is an essential skill that students must develop throughout their academic careers.

      Body Paragraph 1:
      Clear writing helps students express their ideas effectively.

      Conclusion:
      In conclusion, developing strong writing skills is crucial for success.
    `.trim();

    const modifiedContent = originalContent.replace(
      'Body Paragraph 1:\n      Clear writing helps students express their ideas effectively.',
      `Body Paragraph 1:
      Clear writing helps students express their ideas effectively.

      Body Paragraph 2:
      Additionally, writing skills improve critical thinking abilities. When students organize their thoughts in writing, they develop better analytical skills.`
    );

    return await differentialAnalysisTestSuite.runDifferentialAnalysisTest({
      scenario: 'New Paragraph Addition',
      documentId,
      userId,
      originalContent,
      modifiedContent,
      changeType: 'paragraph_addition',
      changeDescription: 'Added new body paragraph about critical thinking'
    });
  },

  // Test Scenario 3: Major document restructure (should use full analysis)
  async testMajorRestructure(documentId: string, userId: string): Promise<DifferentialAnalysisTestResult> {
    const originalContent = `
      Introduction:
      Writing is an essential skill.

      Body:
      Clear writing helps students.

      Conclusion:
      In conclusion, writing is important.
    `.trim();

    const modifiedContent = `
      Abstract:
      This comprehensive analysis examines the multifaceted importance of written communication skills in contemporary educational environments.

      Introduction:
      Academic writing serves as a fundamental cornerstone in higher education, facilitating knowledge transmission and intellectual discourse.

      Literature Review:
      Previous research has demonstrated the correlation between writing proficiency and academic achievement.

      Methodology:
      This study employs a mixed-methods approach to analyze writing effectiveness.

      Results:
      Data indicates significant improvements in student performance when writing skills are emphasized.

      Discussion:
      The implications of these findings suggest that writing instruction should be prioritized across all disciplines.

      Conclusion:
      In summary, the evidence overwhelmingly supports the integration of writing-focused pedagogical approaches.
    `.trim();

    return await differentialAnalysisTestSuite.runDifferentialAnalysisTest({
      scenario: 'Major Document Restructure',
      documentId,
      userId,
      originalContent,
      modifiedContent,
      changeType: 'full_rewrite',
      changeDescription: 'Complete document restructure from simple to academic format'
    });
  },

  // Test Scenario 4: Typo fixes (should use differential analysis)
  async testTypoFixes(documentId: string, userId: string): Promise<DifferentialAnalysisTestResult> {
    const originalContent = `
      Introduction:
      Writting is an esential skill that studens must develope throughout their academic careeres. This essay will explore the importence of clear comunication in academic settings.

      Body Paragraph:
      Clear writting helps studens express their ideas efectivley. When studens write clearley, their profesors can understand their arguements better.
    `.trim();

    const modifiedContent = `
      Introduction:
      Writing is an essential skill that students must develop throughout their academic careers. This essay will explore the importance of clear communication in academic settings.

      Body Paragraph:
      Clear writing helps students express their ideas effectively. When students write clearly, their professors can understand their arguments better.
    `.trim();

    return await differentialAnalysisTestSuite.runDifferentialAnalysisTest({
      scenario: 'Multiple Typo Fixes',
      documentId,
      userId,
      originalContent,
      modifiedContent,
      changeType: 'spelling_corrections',
      changeDescription: 'Fixed multiple spelling errors throughout the document'
    });
  },

  // Core test execution function
  async runDifferentialAnalysisTest(testParams: {
    scenario: string;
    documentId: string;
    userId: string;
    originalContent: string;
    modifiedContent: string;
    changeType: string;
    changeDescription: string;
  }): Promise<DifferentialAnalysisTestResult> {
    const startTime = Date.now();

    try {
      console.log(`🧪 [${testParams.scenario}] Setting up differential analysis test...`);
      
      // Step 1: Track changes between original and modified content
      // This creates the change records that differential analysis depends on
      const changes = await modificationTrackingService.trackParagraphChanges(
        testParams.documentId,
        testParams.userId,
        testParams.originalContent,
        testParams.modifiedContent
      );

      console.log(`🧪 [${testParams.scenario}] Tracked ${changes.length} paragraph changes`);

      // Step 2: Calculate expected performance metrics
      const originalParagraphs = contentAnalysisService.splitIntoParagraphs(testParams.originalContent);
      const modifiedParagraphs = contentAnalysisService.splitIntoParagraphs(testParams.modifiedContent);
      
      console.log(`🔍 [${testParams.scenario}] CHANGE ANALYSIS:`, {
        totalParagraphs: modifiedParagraphs.length,
        changedParagraphs: changes.length,
        changedIndices: changes.map(c => c.index),
        changePercentage: Math.round((changes.length / modifiedParagraphs.length) * 100) + '%'
      });
      const changedIndices = changes.map(change => change.index);
      
      const contextWindow = contentAnalysisService.buildContextWindow(
        modifiedParagraphs,
        changedIndices,
        1 // ±1 paragraph context (more aggressive optimization)
      );
      
      console.log(`🔍 [${testParams.scenario}] CONTEXT WINDOW:`, {
        totalParagraphs: modifiedParagraphs.length,
        changedParagraphs: changedIndices.length,
        contextWindowSize: contextWindow.length,
        contextPercentage: Math.round((contextWindow.length / modifiedParagraphs.length) * 100) + '%',
        expectedTokenSavings: Math.round((1 - contextWindow.length / modifiedParagraphs.length) * 100) + '%'
      });

      // Step 3: Wait a moment for change tracking to complete and verify it worked
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify that changes were tracked
      const hasUnanalyzedChanges = await modificationTrackingService.hasUnanalyzedChanges(
        testParams.documentId,
        testParams.userId
      );
      console.log(`🧪 [${testParams.scenario}] Has unanalyzed changes: ${hasUnanalyzedChanges}`);
      
      // Step 4: Execute differential analysis
      console.log(`🧪 [${testParams.scenario}] Executing differential analysis...`);
      
      // Check if differential analysis should be used
      const shouldUseDifferential = await (suggestionService as any).shouldUseDifferentialAnalysis({
        documentId: testParams.documentId,
        userId: testParams.userId,
        content: testParams.modifiedContent,
        analysisType: 'incremental',
        previousContent: testParams.originalContent
      });
      
      console.log(`🧪 [${testParams.scenario}] Should use differential: ${shouldUseDifferential}`);
      
      const analysisResult = await suggestionService.requestSuggestions({
        documentId: testParams.documentId,
        userId: testParams.userId,
        content: testParams.modifiedContent,
        analysisType: 'incremental', // This should trigger differential analysis
        previousContent: testParams.originalContent
      });
      
      console.log(`🧪 [${testParams.scenario}] Raw analysis result:`, {
        hasOptimizationMetadata: !!(analysisResult as any).optimizationMetadata,
        usedContextWindow: (analysisResult as any).optimizationMetadata?.usedContextWindow,
        tokenSavings: (analysisResult as any).optimizationMetadata?.tokenSavings,
        contextWindowSize: (analysisResult as any).optimizationMetadata?.contextWindowSize,
        hasDifferentialMetadata: !!(analysisResult as any).differentialMetadata,
        isDifferential: (analysisResult as any).differentialMetadata?.isDifferential
      });

      const processingTime = Date.now() - startTime;

      // Step 4: Calculate performance metrics
      const totalParagraphs = modifiedParagraphs.length;
      const changedParagraphs = changedIndices.length;
      const contextWindowSize = contextWindow.length;
      
      // ✅ CRITICAL FIX - Use actual token savings from Firebase response instead of estimates
      const optimizationMetadata = (analysisResult as any).optimizationMetadata;
      let actualTokenSavings = 0;
      
      console.log(`🔍 [${testParams.scenario}] DEBUG - Processing token savings:`, {
        hasOptimizationMetadata: !!optimizationMetadata,
        tokenSavingsObject: optimizationMetadata?.tokenSavings,
        usedContextWindow: optimizationMetadata?.usedContextWindow,
        cacheHit: optimizationMetadata?.cacheHit
      });
      
      if (optimizationMetadata?.tokenSavings?.savings) {
        actualTokenSavings = optimizationMetadata.tokenSavings.savings;
        console.log(`🔍 [${testParams.scenario}] Using Firebase token savings: ${actualTokenSavings}%`);
      } else if (optimizationMetadata?.usedContextWindow) {
        // Calculate from context window if available
        const fullDocumentTokens = Math.ceil(testParams.modifiedContent.length / 4);
        const contextWindowTokens = Math.ceil(
          contextWindow.map(w => w.text).join(' ').length / 4
        );
        actualTokenSavings = Math.round(
          ((fullDocumentTokens - contextWindowTokens) / fullDocumentTokens) * 100
        );
        console.log(`🔍 [${testParams.scenario}] Calculated token savings: ${actualTokenSavings}% (${fullDocumentTokens} → ${contextWindowTokens})`);
      } else {
        // No optimization used - 0% savings
        actualTokenSavings = 0;
        console.log(`🔍 [${testParams.scenario}] No optimization detected: 0%`);
      }
      
      // Check if differential analysis was actually used
      const usedDifferentialAnalysis = !!(analysisResult as any).differentialMetadata?.isDifferential;

      console.log(`🧪 [${testParams.scenario}] Test completed:`, {
        usedDifferentialAnalysis,
        changedParagraphs,
        totalParagraphs,
        actualTokenSavings,
        optimizationUsed: !!optimizationMetadata?.usedContextWindow,
        processingTime,
        suggestionsCount: analysisResult.suggestions?.length || 0,
        optimizationMetadata: optimizationMetadata
      });
      
      // ✅ EASY TO SPOT TEST SUMMARY
      const optimizationWorking = !!optimizationMetadata?.usedContextWindow;
      console.log(`🎯 TEST RESULT [${testParams.scenario}]: ${optimizationWorking ? '✅ WORKING' : '❌ FAILED'} | Token Savings: ${actualTokenSavings}% | Differential: ${usedDifferentialAnalysis}`);;

      return {
        scenario: testParams.scenario,
        testData: {
          originalContent: testParams.originalContent,
          modifiedContent: testParams.modifiedContent,
          changeType: testParams.changeType,
          changeDescription: testParams.changeDescription
        },
        results: {
          usedDifferentialAnalysis,
          changedParagraphs,
          totalParagraphs,
          tokenSavings: actualTokenSavings,
          processingTime,
          suggestionsCount: analysisResult.suggestions?.length || 0
        },
        performance: {
          estimatedTokenSavings: optimizationMetadata?.tokenSavings ? 
            `${actualTokenSavings}% (${optimizationMetadata.tokenSavings.originalTokens} → ${optimizationMetadata.tokenSavings.optimizedTokens} tokens)` :
            `${actualTokenSavings}% (context window optimization)`,
          analysisType: usedDifferentialAnalysis ? 'differential' : 'full',
          contextWindowSize
        }
      };

    } catch (error) {
      console.error(`🧪 [${testParams.scenario}] Test failed:`, error);
      
      const processingTime = Date.now() - startTime;
      
      return {
        scenario: testParams.scenario,
        testData: {
          originalContent: testParams.originalContent,
          modifiedContent: testParams.modifiedContent,
          changeType: testParams.changeType,
          changeDescription: testParams.changeDescription
        },
        results: {
          usedDifferentialAnalysis: false,
          changedParagraphs: 0,
          totalParagraphs: 0,
          tokenSavings: 0,
          processingTime,
          suggestionsCount: 0,
          errorRate: 100
        },
        performance: {
          estimatedTokenSavings: 'Test failed',
          analysisType: 'full',
          contextWindowSize: 0
        }
      };
    }
  },

  // Run comprehensive test suite
  async runFullTestSuite(documentId: string, userId: string): Promise<{
    summary: {
      totalTests: number;
      successfulTests: number;
      averageTokenSavings: number;
      averageProcessingTime: number;
      differentialAnalysisUsageRate: number;
    };
    testResults: DifferentialAnalysisTestResult[];
  }> {
    console.log('🧪 Starting Differential Analysis Test Suite...');
    
    const testResults: DifferentialAnalysisTestResult[] = [];
    
    // Run all test scenarios
    try {
      console.log('🧪 Running test: Minor Edits...');
      testResults.push(await differentialAnalysisTestSuite.testMinorEdits(documentId, userId));
      
      console.log('🧪 Running test: Paragraph Addition...');
      testResults.push(await differentialAnalysisTestSuite.testParagraphAddition(documentId, userId));
      
      console.log('🧪 Running test: Major Restructure...');
      testResults.push(await differentialAnalysisTestSuite.testMajorRestructure(documentId, userId));
      
      console.log('🧪 Running test: Typo Fixes...');
      testResults.push(await differentialAnalysisTestSuite.testTypoFixes(documentId, userId));
    } catch (testError) {
      console.error('🧪 Individual test failed:', testError);
      throw testError;
    }

    // Calculate summary statistics
    const successfulTests = testResults.filter(result => !result.results.errorRate);
    const totalTokenSavings = successfulTests.reduce((sum, result) => sum + result.results.tokenSavings, 0);
    const totalProcessingTime = testResults.reduce((sum, result) => sum + result.results.processingTime, 0);
    const differentialAnalysisUsed = testResults.filter(result => result.results.usedDifferentialAnalysis);

    const summary = {
      totalTests: testResults.length,
      successfulTests: successfulTests.length,
      averageTokenSavings: Math.round(totalTokenSavings / Math.max(successfulTests.length, 1)),
      averageProcessingTime: Math.round(totalProcessingTime / testResults.length),
      differentialAnalysisUsageRate: Math.round((differentialAnalysisUsed.length / testResults.length) * 100)
    };

    console.log('🧪 Test Suite Completed:', summary);
    console.log('🧪 Expected Performance Improvements:');
    console.log(`   • Token Savings: ${summary.averageTokenSavings}% average`);
    console.log(`   • Differential Analysis Usage: ${summary.differentialAnalysisUsageRate}%`);
    console.log(`   • Processing Time: ${summary.averageProcessingTime}ms average`);

    return { summary, testResults };
  },

  // Utility function to generate test report
  generateTestReport(testResults: DifferentialAnalysisTestResult[]): string {
    let report = `
# Differential Analysis Test Report
Generated on: ${new Date().toISOString()}

## Test Summary
| Test Scenario | Analysis Type | Changed Paragraphs | Token Savings | Processing Time | Suggestions |
|---------------|---------------|-------------------|---------------|-----------------|-------------|
`;

    testResults.forEach(result => {
      report += `| ${result.scenario} | ${result.performance.analysisType} | ${result.results.changedParagraphs}/${result.results.totalParagraphs} | ${result.results.tokenSavings}% | ${result.results.processingTime}ms | ${result.results.suggestionsCount} |\n`;
    });

    report += `\n## Performance Analysis\n`;
    testResults.forEach(result => {
      report += `\n### ${result.scenario}\n`;
      report += `- **Change Type**: ${result.testData.changeType}\n`;
      report += `- **Description**: ${result.testData.changeDescription}\n`;
      report += `- **Analysis Type**: ${result.performance.analysisType}\n`;
      report += `- **Token Savings**: ${result.performance.estimatedTokenSavings}\n`;
      report += `- **Context Window Size**: ${result.performance.contextWindowSize} paragraphs\n`;
      report += `- **Differential Analysis Used**: ${result.results.usedDifferentialAnalysis ? '✅ Yes' : '❌ No'}\n`;
    });

    return report;
  }
};

// Export utility functions for use in components
export const testDifferentialAnalysis = async (documentId: string, userId: string) => {
  try {
    console.log('🧪 Starting differential analysis test suite...');
    const result = await differentialAnalysisTestSuite.runFullTestSuite(documentId, userId);
    console.log('🧪 Test suite completed successfully:', result);
    return result;
  } catch (error) {
    console.error('🧪 Test suite failed:', error);
    throw error;
  }
};

export const generateDifferentialAnalysisReport = differentialAnalysisTestSuite.generateTestReport; 