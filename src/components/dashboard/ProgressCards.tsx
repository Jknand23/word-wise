import React, { useState } from 'react';
import { Target, TrendingUp, Award, Settings, Edit2 } from 'lucide-react';
import type { ProgressData } from '../../services/progressService';

interface ProgressCardsProps {
  progressData: ProgressData;
  onUpdateWeeklyGoal: (goal: number) => void;
}

const ProgressCards: React.FC<ProgressCardsProps> = ({ progressData, onUpdateWeeklyGoal }) => {
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [goalInput, setGoalInput] = useState(progressData.weeklyGoal.toString());

  // Update goalInput when progressData changes
  React.useEffect(() => {
    setGoalInput(progressData.weeklyGoal.toString());
  }, [progressData.weeklyGoal]);

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newGoal = parseInt(goalInput);
    console.log('ProgressCards: Setting new goal:', newGoal, 'Current goal:', progressData.weeklyGoal);
    if (newGoal > 0 && newGoal <= 20) {
      onUpdateWeeklyGoal(newGoal);
      setShowGoalEdit(false);
    }
  };

  const getProgressPercentage = () => {
    if (progressData.weeklyGoal === 0) return 0;
    return Math.min((progressData.documentsThisWeek / progressData.weeklyGoal) * 100, 100);
  };

  const getTrendIcon = () => {
    switch (progressData.trend) {
      case 'improving':
        return '↗️';
      case 'declining':
        return '↘️';
      default:
        return '➡️';
    }
  };

  const getTrendDescription = () => {
    switch (progressData.trend) {
      case 'improving':
        return 'Improving - Your error rate is decreasing!';
      case 'declining':
        return 'Declining - More practice needed';
      default:
        return 'Steady - Consistent performance';
    }
  };

  const getTrendMessage = () => {
    if (progressData.recentErrorRate === 0) {
      return 'Start writing to track quality!';
    }

    switch (progressData.trend) {
      case 'improving':
        return 'Quality improving! 🎉';
      case 'declining':
        return 'Keep practicing! 💪';
      default:
        return 'Steady progress 📈';
    }
  };

  const renderProgressBar = () => {
    const _percentage = getProgressPercentage();
    const segments = Array.from({ length: progressData.weeklyGoal }, (_, i) => i);
    
    return (
      <div className="flex space-x-1 mb-3">
        {segments.map((_, index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full ${
              index < progressData.documentsThisWeek
                ? 'bg-gradient-to-r from-accent-teal to-accent-cyan'
                : 'bg-soft-cream/50'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Writing Consistency Card */}
      <div className="warm-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-teal to-accent-cyan p-3 text-white shadow-lg">
              <Target className="h-6 w-6" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-bold encouraging-text">Weekly Goal</h3>
              <p className="text-sm text-gray-600">Stay consistent! ✨</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowGoalEdit(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-soft-cream/50 rounded-full transition-colors"
            title="Edit weekly goal"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {renderProgressBar()}

        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold encouraging-text">
              {progressData.documentsThisWeek}/{progressData.weeklyGoal}
            </span>
            <span className="text-sm text-gray-600 ml-2">documents</span>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-accent-teal">
              {Math.round(getProgressPercentage())}% complete
            </div>
            <div className="text-xs text-gray-500">
              {progressData.weeklyGoal - progressData.documentsThisWeek > 0
                ? `${progressData.weeklyGoal - progressData.documentsThisWeek} more to go!`
                : 'Goal achieved! 🎉'
              }
            </div>
          </div>
        </div>

        {/* Goal Edit Modal */}
        {showGoalEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold encouraging-text mb-4">Set Weekly Goal</h3>
              <form onSubmit={handleGoalSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documents per week
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-teal focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-accent-teal to-accent-cyan text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                  >
                    Save Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGoalEdit(false);
                      setGoalInput(progressData.weeklyGoal.toString());
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Quality Improvement Card */}
      <div className="warm-card">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-emerald to-accent-forest p-3 text-white shadow-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-bold encouraging-text">Writing Quality</h3>
            <p className="text-sm text-gray-600">{getTrendMessage()}</p>
          </div>
        </div>

        <div className="space-y-3">
          {progressData.recentErrorRate > 0 ? (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-gray-600">Error Rate</span>
                    <span className="text-lg font-bold encouraging-text">
                      {progressData.recentErrorRate}
                    </span>
                    <span className="text-sm text-gray-600 font-normal">/100 words</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {getTrendDescription()}
                    </span>
                    <div 
                      className="cursor-help"
                      title={getTrendDescription()}
                    >
                      <span className="text-lg">{getTrendIcon()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {progressData.personalBest > 0 && (
                <div className="flex items-center justify-between p-2 bg-soft-cream/50 rounded-lg">
                  <div className="flex items-center">
                    <Award className="h-4 w-4 text-accent-gold mr-2" />
                    <span className="text-sm font-medium">Personal Best</span>
                  </div>
                  <span className="text-sm font-bold text-accent-gold">
                    {progressData.personalBest}/100 words
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <Edit2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Create documents with AI suggestions to track your writing quality progress
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressCards; 