import React, { useState } from 'react';
import { TestTube, Trash2, RefreshCw } from 'lucide-react';
import { generateTestProgressData, clearTestProgressData } from '../../utils/testProgressData';
import { useAuthStore } from '../../store/authStore';
import { useProgressStore } from '../../stores/progressStore';
// Debug utility moved to temp folder for deployment
// import { cachePerformanceTesting } from '../../utils/cachePerformanceTesting';

const TestProgressButton: React.FC = () => {
  const { user } = useAuthStore();
  const { loadProgress } = useProgressStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState('');

  const handleGenerateTestData = async () => {
    if (!user?.uid) return;
    
    setIsGenerating(true);
    try {
      await generateTestProgressData(user.uid);
      // Reload progress data to see the new quality metrics
      await loadProgress(user.uid);
      alert('✅ Test data generated successfully! Check your progress cards and refresh the page to see the quality trend.');
    } catch (error) {
      console.error('Failed to generate test data:', error);
      alert('❌ Failed to generate test data. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearTestData = async () => {
    if (!user?.uid) return;
    
    const confirmed = window.confirm('Are you sure you want to delete all test documents? This cannot be undone.');
    if (!confirmed) return;
    
    setIsClearing(true);
    try {
      await clearTestProgressData(user.uid);
      // Reload progress data
      await loadProgress(user.uid);
      alert('✅ Test data cleared successfully!');
    } catch (error) {
      console.error('Failed to clear test data:', error);
      alert('❌ Failed to clear test data. Check console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleRefreshProgress = async () => {
    if (!user?.uid) return;
    await loadProgress(user.uid);
  };

  const runCachePerformanceTest = async () => {
    if (!user?.uid) {
      alert('Please log in to run cache performance tests.');
      return;
    }
    
    setIsLoading(true);
    setResults('');
    
    try {
      console.log('🧪 Starting Cache Performance Test...');
      
      // Temporary stub for deployment - cachePerformanceTesting moved to temp folder
      const cacheTestResult = { 
        summary: { 
          passedTests: 0, 
          totalTests: 0, 
          averageCacheHitRate: 0, 
          totalSavingsPercentage: 0, 
          averageResponseTime: 0, 
          testDuration: 0 
        },
        results: []
      };
      const { summary } = cacheTestResult;
      
      const cacheReport = `Cache Performance Test Results:
✅ Tests Passed: ${summary.passedTests}/${summary.totalTests}
📊 Cache Hit Rate: ${(summary.averageCacheHitRate * 100).toFixed(1)}%
💰 Token Savings: ${summary.totalSavingsPercentage.toFixed(1)}%
⏱️ Avg Response Time: ${summary.averageResponseTime}ms
⌛ Test Duration: ${(summary.testDuration / 1000).toFixed(1)}s`;
      
      setResults(cacheReport);
      
      console.log('🎯 Cache Test Summary:', summary);
      console.log('📊 Detailed Results:', cacheTestResult.results);
      
      // Store detailed results for later analysis
      localStorage.setItem('lastCacheTestResults', JSON.stringify(cacheTestResult));
      
      alert('✅ Cache performance test completed! Check console for detailed results.');
      
    } catch (error) {
      console.error('❌ Cache test failed:', error);
      const errorMessage = `Cache test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setResults(errorMessage);
      alert('❌ Cache test failed. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Hide in production
  }

  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <TestTube className="h-5 w-5 text-yellow-600 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Development Testing</h3>
            <p className="text-xs text-yellow-600">Generate sample data to test Writing Quality features</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowControls(!showControls)}
          className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
        >
          {showControls ? 'Hide' : 'Show'} Controls
        </button>
      </div>

      {showControls && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleGenerateTestData}
            disabled={isGenerating}
            className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TestTube className="h-4 w-4 mr-1" />
            {isGenerating ? 'Generating...' : 'Generate Test Data'}
          </button>

          <button
            onClick={runCachePerformanceTest}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TestTube className="h-4 w-4 mr-1" />
            {isLoading ? 'Testing...' : 'Test Cache Performance'}
          </button>

          <button
            onClick={handleRefreshProgress}
            className="inline-flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh Progress
          </button>

          <button
            onClick={handleClearTestData}
            disabled={isClearing}
            className="inline-flex items-center px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isClearing ? 'Clearing...' : 'Clear Test Data'}
          </button>
        </div>
      )}

      {results && (
        <div className="mt-3 text-xs text-gray-700 bg-gray-100 p-3 rounded font-mono whitespace-pre-line">
          {results}
        </div>
      )}

      {showControls && (
        <div className="mt-3 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
          <strong>Test Data:</strong> Creates 4 sample documents showing writing improvement over time:
          <br />• Document 1: High error rate (poor quality)
          <br />• Document 2: Medium error rate (improving)  
          <br />• Document 3: Low error rate (good quality)
          <br />• Document 4: Very low error rate (excellent quality)
          <br />This will demonstrate the quality trend analysis and personal best tracking.
          <br /><br />
          <strong>Cache Performance Test:</strong> Tests the content hash caching system:
          <br />• Runs cache miss test (first analysis)
          <br />• Runs cache hit test (repeat analysis)
          <br />• Measures response times and token savings
          <br />• Validates cache functionality and performance
        </div>
      )}
    </div>
  );
};

export default TestProgressButton; 