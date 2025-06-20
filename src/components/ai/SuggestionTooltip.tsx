import React from 'react';
import { Type, AlertTriangle, Lightbulb, Sparkles, MessageSquare, Layout, Brain, BookOpen } from 'lucide-react';
import type { Suggestion } from '../../types/suggestion';

interface SuggestionTooltipProps {
  suggestion: Suggestion;
  isVisible: boolean;
  position: { x: number; y: number };
  onAccept: () => void;
  onReject: () => void;
}

const SuggestionTooltip: React.FC<SuggestionTooltipProps> = ({
  suggestion,
  isVisible,
  position,
  onAccept,
  onReject
}) => {
  if (!isVisible) return null;

  const getSuggestionIcon = (type: Suggestion['type']) => {
    const iconProps = { className: "w-4 h-4" };
    switch (type) {
      case 'spelling':
        return <Type {...iconProps} className="w-4 h-4 text-red-500" />;
      case 'clarity':
        return <Lightbulb {...iconProps} className="w-4 h-4 text-yellow-500" />;
      case 'engagement':
        return <Sparkles {...iconProps} className="w-4 h-4 text-blue-500" />;
      case 'grammar':
        return <AlertTriangle {...iconProps} className="w-4 h-4 text-orange-500" />;
      case 'tone':
        return <MessageSquare {...iconProps} className="w-4 h-4 text-purple-500" />;
      case 'structure':
        return <Layout {...iconProps} className="w-4 h-4 text-green-500" />;
      case 'depth':
        return <Brain {...iconProps} className="w-4 h-4 text-indigo-500" />;
      case 'vocabulary':
        return <BookOpen {...iconProps} className="w-4 h-4 text-pink-500" />;
      default:
        return <Lightbulb {...iconProps} />;
    }
  };

  const getSeverityColor = (severity: Suggestion['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  return (
    <div
      className={`fixed z-50 p-3 border-l-4 bg-white shadow-xl rounded-lg border border-gray-200 ${getSeverityColor(suggestion.severity)}`}
      style={{
        left: `${Math.max(10, position.x)}px`,
        top: `${Math.max(10, position.y)}px`,
        width: '325px',
        maxHeight: `${Math.floor(window.innerHeight * 0.5)}px`,
        overflowY: 'auto',
        wordWrap: 'break-word'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {getSuggestionIcon(suggestion.type)}
        <span className="font-semibold text-gray-900 capitalize">
          {suggestion.type} {suggestion.category}
        </span>
        {suggestion.grammarRule && (
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            {suggestion.grammarRule}
          </span>
        )}
      </div>

      {/* Original vs Suggested */}
      <div className="space-y-2 mb-3">
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Original:</span>
          <p className="text-sm text-gray-700 bg-red-50 px-2 py-1 rounded">
            "{suggestion.originalText}"
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested:</span>
          <p className="text-sm text-gray-700 bg-green-50 px-2 py-1 rounded">
            "{suggestion.suggestedText}"
          </p>
        </div>
      </div>

      {/* Educational Explanation */}
      {suggestion.educationalExplanation && (
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Explanation:</span>
          <p className="text-sm text-gray-700 mt-1">
            {suggestion.educationalExplanation}
          </p>
        </div>
      )}

      {/* Example */}
      {suggestion.example && (
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Example:</span>
          <p className="text-sm text-gray-600 italic bg-gray-50 px-2 py-1 rounded mt-1">
            {suggestion.example}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t">
        <button
          onClick={onAccept}
          className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
};

export default SuggestionTooltip; 