import React, { useState } from 'react';
import { TestTube, Trash2, RefreshCw } from 'lucide-react';
import { generateTestProgressData, clearTestProgressData } from '../../utils/testProgressData';
import { useAuthStore } from '../../store/authStore';
import { useProgressStore } from '../../stores/progressStore';

const TestProgressButton: React.FC = () => {
  const { user } = useAuthStore();
  const { loadProgress } = useProgressStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showControls, setShowControls] = useState(false);

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

      {showControls && (
        <div className="mt-3 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
          <strong>Test Data:</strong> Creates 4 sample documents showing writing improvement over time:
          <br />• Document 1: High error rate (poor quality)
          <br />• Document 2: Medium error rate (improving)  
          <br />• Document 3: Low error rate (good quality)
          <br />• Document 4: Very low error rate (excellent quality)
          <br />This will demonstrate the quality trend analysis and personal best tracking.
        </div>
      )}
    </div>
  );
};

export default TestProgressButton; 