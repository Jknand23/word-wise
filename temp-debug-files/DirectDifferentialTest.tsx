import React, { useState } from 'react';
import { modificationTrackingService } from '../../services/modificationTrackingService';
import { suggestionService } from '../../services/suggestionService';
import { useAuthStore } from '../../store/authStore';

export const DirectDifferentialTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { user } = useAuthStore();

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const runDirectTest = async () => {
    if (!user?.uid) {
      addLog('❌ No user authenticated');
      return;
    }

    setIsRunning(true);
    setResults(null);
    setLogs([]);

    try {
      const testDocumentId = `direct-test-${Date.now()}`;
      const userId = user.uid;

      addLog('🧪 Starting direct differential analysis test...');

      // Step 1: Test content
      const originalContent = `Introduction:
Writing is important for students.

Body:
Clear writing helps communicate ideas.

Conclusion:
In summary, writing matters.`;

      const modifiedContent = originalContent.replace(
        'Writing is important for students',
        'Writing is crucial for academic success'
      );

      addLog(`📝 Original content: ${originalContent.length} characters`);
      addLog(`📝 Modified content: ${modifiedContent.length} characters`);

      // Step 2: Track changes
      addLog('🔍 Step 1: Tracking paragraph changes...');
      const changes = await modificationTrackingService.trackParagraphChanges(
        testDocumentId,
        userId,
        originalContent,
        modifiedContent
      );
      addLog(`✅ Tracked ${changes.length} changes`);

      // Step 3: Wait for persistence
      addLog('⏱️ Step 2: Waiting for database persistence...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Check for unanalyzed changes
      addLog('🔍 Step 3: Checking for unanalyzed changes...');
      const hasUnanalyzed = await modificationTrackingService.hasUnanalyzedChanges(
        testDocumentId,
        userId
      );
      addLog(`📊 Has unanalyzed changes: ${hasUnanalyzed}`);

      // Step 5: Get unanalyzed changes directly
      addLog('🔍 Step 4: Getting unanalyzed changes directly...');
      const unanalyzedChanges = await modificationTrackingService.getUnanalyzedChanges(
        testDocumentId,
        userId
      );
      addLog(`📋 Found ${unanalyzedChanges.length} unanalyzed change records`);

      // Step 5.5: Test simpler query to debug the issue
      addLog('🔍 Step 4.5: Testing simpler query for ALL documentChanges...');
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        
        // Test query without orderBy to avoid index issues
        const simpleQuery = query(
          collection(db, 'documentChanges'),
          where('documentId', '==', testDocumentId)
        );
        
        const simpleSnapshot = await getDocs(simpleQuery);
        addLog(`📋 Simple query found ${simpleSnapshot.docs.length} records`);
        
        simpleSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          addLog(`📄 Record ${index + 1}: ${doc.id} - analyzed: ${data.analyzed}, userId: ${data.userId}`);
        });
      } catch (queryError) {
        addLog(`❌ Simple query failed: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`);
      }

      // Step 6: Test shouldUseDifferentialAnalysis
      addLog('🔍 Step 5: Testing shouldUseDifferentialAnalysis...');
      const shouldUseDifferential = await (suggestionService as any).shouldUseDifferentialAnalysis({
        documentId: testDocumentId,
        userId,
        content: modifiedContent,
        analysisType: 'incremental'
      });
      addLog(`🎯 Should use differential: ${shouldUseDifferential}`);

      // Step 7: Test full request
      addLog('🔍 Step 6: Testing full suggestion request...');
      const startTime = Date.now();
      
      const result = await suggestionService.requestSuggestions({
        documentId: testDocumentId,
        userId,
        content: modifiedContent,
        analysisType: 'incremental',
        previousContent: originalContent
      });
      
      const processingTime = Date.now() - startTime;
      addLog(`⚡ Processing completed in ${processingTime}ms`);

      // Step 8: Check if differential was used
      const usedDifferential = !!(result as any).differentialMetadata?.isDifferential;
      addLog(`🎯 Used differential analysis: ${usedDifferential}`);

      setResults({
        changesTracked: changes.length,
        hasUnanalyzedChanges: hasUnanalyzed,
        unanalyzedChangesCount: unanalyzedChanges.length,
        shouldUseDifferential,
        usedDifferential,
        processingTime,
        suggestionsCount: result.suggestions?.length || 0,
        success: true
      });

      addLog('✅ Direct test completed successfully!');

    } catch (error) {
      addLog(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Direct test error:', error);
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">🔬 Direct Differential Analysis Test</h3>
          <p className="text-sm text-gray-600 mt-1">
            Simple direct test to isolate differential analysis functionality
          </p>
        </div>
        <button
          onClick={runDirectTest}
          disabled={isRunning}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isRunning
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
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
              Running...
            </span>
          ) : (
            'Run Direct Test'
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">📊 Test Results</h4>
          {results.success ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">Changes Tracked</p>
                <p className="text-xl font-bold text-blue-600">{results.changesTracked}</p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">Has Unanalyzed</p>
                <p className="text-xl font-bold text-green-600">{results.hasUnanalyzedChanges ? '✅' : '❌'}</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">Should Use Diff</p>
                <p className="text-xl font-bold text-purple-600">{results.shouldUseDifferential ? '✅' : '❌'}</p>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">Used Differential</p>
                <p className="text-xl font-bold text-orange-600">{results.usedDifferential ? '✅' : '❌'}</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">Processing Time</p>
                <p className="text-xl font-bold text-gray-600">{results.processingTime}ms</p>
              </div>
              
              <div className="bg-indigo-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">Suggestions</p>
                <p className="text-xl font-bold text-indigo-600">{results.suggestionsCount}</p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Test Failed</p>
              <p className="text-red-700 text-sm mt-1">{results.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">📋 Detailed Logs</h4>
          <div className="bg-gray-900 text-green-400 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {!results && !isRunning && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🔬</div>
          <p className="text-lg font-medium">Ready to run direct differential analysis test</p>
          <p className="text-sm mt-2">
            This will test each step of the differential analysis process in isolation
          </p>
        </div>
      )}
    </div>
  );
}; 