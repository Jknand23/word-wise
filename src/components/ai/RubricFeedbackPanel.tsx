import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, TrendingUp, Target, Lightbulb, Loader, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { rubricService } from '../../services/rubricService';
import { useWritingGoalsStore } from '../../store/writingGoalsStore';
import type { AssignmentRubric, RubricFeedback, RubricAnalysisResult } from '../../types/suggestion';

interface RubricFeedbackPanelProps {
  documentId: string;
  content: string;
  selectedRubric: AssignmentRubric | null;
}

const RubricFeedbackPanel: React.FC<RubricFeedbackPanelProps> = ({ documentId, content, selectedRubric }) => {
  const user = useAuthStore((state) => state.user);
  const academicLevel = useWritingGoalsStore((state) => state.goals.academicLevel);
  
  console.log('RubricFeedbackPanel: Current academic level from store:', academicLevel);
  const [feedback, setFeedback] = useState<RubricFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedLength, setLastAnalyzedLength] = useState(0);

  const handleAnalyze = async () => {
    if (!user || !selectedRubric || !content.trim()) {
      setError('Cannot analyze. User, rubric, or content is missing.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setFeedback(null);

    try {
      console.log('Analyzing with academic level:', academicLevel);
      const result = await rubricService.requestRubricAnalysis(
        content,
        documentId,
        user.uid,
        selectedRubric,
        academicLevel
      );
      setFeedback(result.feedback);
      setLastAnalyzedLength(content.length);
    } catch (err) {
      console.error('Failed to analyze with rubric:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to analyze content against rubric: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // Auto-analyze when content changes significantly
    if (content.length > 50 && Math.abs(content.length - lastAnalyzedLength) > 100) {
      handleAnalyze();
    }
  }, [content]);

  if (!selectedRubric) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-50">
        <Info className="w-10 h-10 text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700">No Rubric Selected</h3>
        <p className="text-sm text-gray-500 text-center">Please select a rubric to see feedback and analysis.</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 0.8) return 'bg-green-100';
    if (score >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getIssueIcon = (type: RubricAnalysisResult['specificIssues'][0]['type']) => {
    switch (type) {
      case 'missing': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'insufficient': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'incorrect': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'needs-improvement': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatScore = (score: number) => Math.round(score * 100);

  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const getWordCountStatus = () => {
    const requirements = selectedRubric.extractedRequirements.wordCount;
    if (!requirements) return null;
    
    const { min, max } = requirements;
    if (min && wordCount < min) {
      return { status: 'below', message: `${wordCount} / ${min}+ words needed`, color: 'text-red-600' };
    }
    if (max && wordCount > max) {
      return { status: 'above', message: `${wordCount} / ${max} words (over limit)`, color: 'text-yellow-600' };
    }
    if (min && wordCount >= min) {
      return { status: 'good', message: `${wordCount} words (meets requirement)`, color: 'text-green-600' };
    }
    return { status: 'unknown', message: `${wordCount} words`, color: 'text-gray-600' };
  };

  const wordCountStatus = getWordCountStatus();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Rubric Feedback</h3>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !content.trim()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Target className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-600">{selectedRubric.title}</p>
        
        {/* Word Count Status */}
        {wordCountStatus && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-gray-500">Word Count:</span>
            <span className={`text-sm font-medium ${wordCountStatus.color}`}>
              {wordCountStatus.message}
            </span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!feedback && !isAnalyzing ? (
          <div className="text-center p-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">Ready to analyze</p>
            <p className="text-sm">Click "Analyze" to see how your writing matches the rubric</p>
          </div>
        ) : isAnalyzing ? (
          <div className="flex items-center justify-center p-8">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Analyzing against rubric...</span>
          </div>
        ) : feedback ? (
          <div className="p-4 space-y-6">
            {/* Overall Score */}
            <div className={`p-4 rounded-lg ${getScoreBackground(feedback.overallScore)}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Overall Score</h4>
                <span className={`text-2xl font-bold ${getScoreColor(feedback.overallScore)}`}>
                  {formatScore(feedback.overallScore)}%
                </span>
              </div>
              <p className="text-sm text-gray-700">{feedback.overallFeedback}</p>
            </div>

            {/* Criteria Results */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Criteria Breakdown</h4>
              {feedback.criteriaResults.map((result) => {
                const criterion = selectedRubric.criteria.find(c => c.id === result.criterionId);
                if (!criterion) return null;

                return (
                  <div key={result.criterionId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">{criterion.name}</h5>
                        <p className="text-sm text-gray-600">{criterion.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-semibold ${getScoreColor(result.score)}`}>
                          {formatScore(result.score)}%
                        </span>
                        <div className="text-xs text-gray-500">
                          Weight: {Math.round(criterion.weight * 100)}%
                        </div>
                      </div>
                    </div>

                    {/* Feedback */}
                    <div className="mb-3">
                      <p className="text-sm text-gray-700">{result.feedback}</p>
                    </div>

                    {/* Met Expectations */}
                    {result.metExpectations.length > 0 && (
                      <div className="mb-3">
                        <h6 className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Met Expectations
                        </h6>
                        <ul className="text-sm text-green-600 space-y-1">
                          {result.metExpectations.map((exp, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">•</span>
                              {exp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missed Expectations */}
                    {result.missedExpectations.length > 0 && (
                      <div className="mb-3">
                        <h6 className="text-sm font-medium text-red-700 mb-1 flex items-center gap-1">
                          <XCircle className="w-4 h-4" />
                          Missed Expectations
                        </h6>
                        <ul className="text-sm text-red-600 space-y-1">
                          {result.missedExpectations.map((exp, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              {exp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Specific Issues */}
                    {result.specificIssues.length > 0 && (
                      <div>
                        <h6 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                          <Lightbulb className="w-4 h-4" />
                          Specific Issues & Suggestions
                        </h6>
                        <div className="space-y-2">
                          {result.specificIssues.map((issue, index) => (
                            <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                              {getIssueIcon(issue.type)}
                              <div className="flex-1">
                                <p className="text-sm text-gray-700">{issue.description}</p>
                                {issue.suggestion && (
                                  <p className="text-sm text-blue-600 mt-1">
                                    <strong>Suggestion:</strong> {issue.suggestion}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Requirements Check */}
            {Object.keys(selectedRubric.extractedRequirements).length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Requirements Checklist</h4>
                <div className="space-y-2">
                  {selectedRubric.extractedRequirements.wordCount && (
                    <div className="flex items-center gap-2">
                      {wordCountStatus?.status === 'good' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">{wordCountStatus?.message}</span>
                    </div>
                  )}
                  
                  {selectedRubric.extractedRequirements.citationCount && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm">
                        Citations: Check manually for {selectedRubric.extractedRequirements.citationCount.min}+ sources
                        {selectedRubric.extractedRequirements.citationCount.style && 
                          ` in ${selectedRubric.extractedRequirements.citationCount.style} format`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RubricFeedbackPanel; 