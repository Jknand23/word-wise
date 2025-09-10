import React, { useState } from 'react';
import { testDifferentialAnalysis } from '../../utils/differentialAnalysisTest';
import type { DifferentialAnalysisTestResult } from '../../utils/differentialAnalysisTest';
import { useAuthStore } from '../../store/authStore';

interface TestResults {
  summary: {
    totalTests: number;
    successfulTests: number;
    averageTokenSavings: number;
    averageProcessingTime: number;
    differentialAnalysisUsageRate: number;
  };
  testResults: DifferentialAnalysisTestResult[];
  startTime: number;
  endTime: number;
}

export const DifferentialAnalysisTestButton: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const runTests = async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);
    
    try {
      const startTime = Date.now();
      console.log('🧪 Starting Differential Analysis Performance Tests...');
      
      // Use a test document ID
      const testDocumentId = `test-differential-analysis-${Date.now()}`;
      
      const testResults = await testDifferentialAnalysis(testDocumentId, user.uid);
      const endTime = Date.now();
      
      setResults({
        summary: testResults.summary,
        testResults: testResults.testResults,
        startTime,
        endTime
      });
      
      console.log('🧪 Differential Analysis Tests Completed Successfully!');
    } catch (error) {
      console.error('🧪 Test failed:', error);
      setError(error instanceof Error ? error.message : 'Test failed with unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const getPerformanceIndicator = (value: number, type: 'savings' | 'time' | 'usage') => {
    switch (type) {
      case 'savings':
        if (value >= 60) return { color: 'text-green-600', icon: '🎉', label: 'Excellent' };
        if (value >= 40) return { color: 'text-blue-600', icon: '👍', label: 'Good' };
        if (value >= 20) return { color: 'text-yellow-600', icon: '⚠️', label: 'Fair' };
        return { color: 'text-red-600', icon: '❌', label: 'Poor' };
      
      case 'time':
        if (value <= 1000) return { color: 'text-green-600', icon: '⚡', label: 'Fast' };
        if (value <= 2000) return { color: 'text-blue-600', icon: '👍', label: 'Good' };
        if (value <= 3000) return { color: 'text-yellow-600', icon: '⚠️', label: 'Slow' };
        return { color: 'text-red-600', icon: '🐌', label: 'Very Slow' };
      
      case 'usage':
        if (value >= 75) return { color: 'text-green-600', icon: '🎯', label: 'Optimal' };
        if (value >= 50) return { color: 'text-blue-600', icon: '👍', label: 'Good' };
        if (value >= 25) return { color: 'text-yellow-600', icon: '⚠️', label: 'Limited' };
        return { color: 'text-red-600', icon: '❌', label: 'Poor' };
      
      default:
        return { color: 'text-gray-600', icon: '?', label: 'Unknown' };
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">🔍 Differential Analysis Performance Tests</h3>
          <p className="text-sm text-gray-600 mt-1">
            Test the effectiveness of differential analysis vs full document analysis
          </p>
        </div>
        <button
          onClick={runTests}
          disabled={isRunning}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isRunning
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isRunning ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  className="opacity-75"
                />
              </svg>
              Running Tests...
            </span>
          ) : (
            'Run Performance Tests'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <span className="text-red-400 mr-2">❌</span>
            <div>
              <h4 className="text-sm font-medium text-red-800">Test Failed</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Overall Performance Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 Performance Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Token Savings</p>
                    <p className="text-2xl font-bold text-gray-900">{results.summary.averageTokenSavings}%</p>
                  </div>
                  <span className="text-2xl">
                    {getPerformanceIndicator(results.summary.averageTokenSavings, 'savings').icon}
                  </span>
                </div>
                <p className={`text-xs mt-1 font-medium ${getPerformanceIndicator(results.summary.averageTokenSavings, 'savings').color}`}>
                  {getPerformanceIndicator(results.summary.averageTokenSavings, 'savings').label}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Processing Time</p>
                    <p className="text-2xl font-bold text-gray-900">{formatDuration(results.summary.averageProcessingTime)}</p>
                  </div>
                  <span className="text-2xl">
                    {getPerformanceIndicator(results.summary.averageProcessingTime, 'time').icon}
                  </span>
                </div>
                <p className={`text-xs mt-1 font-medium ${getPerformanceIndicator(results.summary.averageProcessingTime, 'time').color}`}>
                  {getPerformanceIndicator(results.summary.averageProcessingTime, 'time').label}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Differential Usage</p>
                    <p className="text-2xl font-bold text-gray-900">{results.summary.differentialAnalysisUsageRate}%</p>
                  </div>
                  <span className="text-2xl">
                    {getPerformanceIndicator(results.summary.differentialAnalysisUsageRate, 'usage').icon}
                  </span>
                </div>
                <p className={`text-xs mt-1 font-medium ${getPerformanceIndicator(results.summary.differentialAnalysisUsageRate, 'usage').color}`}>
                  {getPerformanceIndicator(results.summary.differentialAnalysisUsageRate, 'usage').label}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Test Duration</p>
                    <p className="text-2xl font-bold text-gray-900">{formatDuration(results.endTime - results.startTime)}</p>
                  </div>
                  <span className="text-2xl">⏱️</span>
                </div>
                <p className="text-xs mt-1 font-medium text-gray-600">
                  {results.summary.successfulTests}/{results.summary.totalTests} tests passed
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Test Results */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">📋 Detailed Test Results</h4>
            <div className="space-y-4">
              {results.testResults.map((testResult, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h5 className="font-semibold text-gray-900">{testResult.scenario}</h5>
                      <p className="text-sm text-gray-600">{testResult.testData.changeDescription}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        testResult.results.usedDifferentialAnalysis
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {testResult.performance.analysisType === 'differential' ? '🔍 Differential' : '📄 Full Document'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {testResult.results.changedParagraphs}/{testResult.results.totalParagraphs} paragraphs
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-600">Token Savings</p>
                      <p className="text-lg font-semibold text-green-600">{testResult.results.tokenSavings}%</p>
                      <p className="text-xs text-gray-500">{testResult.performance.estimatedTokenSavings}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Processing Time</p>
                      <p className="text-lg font-semibold text-blue-600">{formatDuration(testResult.results.processingTime)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Suggestions</p>
                      <p className="text-lg font-semibold text-purple-600">{testResult.results.suggestionsCount}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Context Window</p>
                      <p className="text-lg font-semibold text-orange-600">{testResult.performance.contextWindowSize}</p>
                      <p className="text-xs text-gray-500">paragraphs analyzed</p>
                    </div>
                  </div>

                  {testResult.results.errorRate && testResult.results.errorRate > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        ⚠️ Test completed with {testResult.results.errorRate}% error rate
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">💡 Performance Insights</h4>
            <div className="space-y-3 text-sm">
              {results.summary.averageTokenSavings >= 60 && (
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">✅</span>
                  <p className="text-gray-700">
                    <strong>Excellent token efficiency!</strong> Differential analysis is saving an average of {results.summary.averageTokenSavings}% on API costs.
                  </p>
                </div>
              )}
              
              {results.summary.differentialAnalysisUsageRate >= 75 && (
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">✅</span>
                  <p className="text-gray-700">
                    <strong>High differential usage rate!</strong> {results.summary.differentialAnalysisUsageRate}% of scenarios are using optimized differential analysis.
                  </p>
                </div>
              )}
              
              {results.summary.averageProcessingTime <= 1500 && (
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">✅</span>
                  <p className="text-gray-700">
                    <strong>Fast processing times!</strong> Average analysis completes in {formatDuration(results.summary.averageProcessingTime)}.
                  </p>
                </div>
              )}

              {results.summary.successfulTests === results.summary.totalTests && (
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">✅</span>
                  <p className="text-gray-700">
                    <strong>All tests passed!</strong> Differential analysis is working reliably across all test scenarios.
                  </p>
                </div>
              )}

              {results.summary.averageTokenSavings < 40 && (
                <div className="flex items-start">
                  <span className="text-yellow-500 mr-2">⚠️</span>
                  <p className="text-gray-700">
                    <strong>Consider optimization:</strong> Token savings below expected threshold. Check if context windows are too large.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!results && !isRunning && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🧪</div>
          <p className="text-lg font-medium">Ready to test differential analysis performance</p>
          <p className="text-sm mt-2">
            Click "Run Performance Tests" to evaluate token savings, processing speed, and differential analysis effectiveness
          </p>
        </div>
      )}
    </div>
  );
}; 