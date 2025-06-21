import React, { useState } from 'react';
import { Tag, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';

const ParagraphTaggingControls: React.FC = () => {
  const {
    tags,
    isLoading,
    error
  } = useParagraphTagStore();

  const [showError, setShowError] = useState(true);

  const needsReviewCount = tags.filter(tag => tag.tagType === 'needs-review').length;
  const doneCount = tags.filter(tag => tag.tagType === 'done').length;

  const handleDismissError = () => {
    setShowError(false);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50 border-b border-gray-200">
      {/* Error Display */}
      {error && showError && (
        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Paragraph Tags Error:</p>
              <p>{error}</p>
            </div>
          </div>
          <button
            onClick={handleDismissError}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-700">Paragraph Tags</h3>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          )}
        </div>
      </div>

      {/* Tag Statistics */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span className="font-medium">{tags.length}</span>
          <span>total</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-yellow-600" />
          <span className="font-medium">{needsReviewCount}</span>
          <span>need review</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span className="font-medium">{doneCount}</span>
          <span>done</span>
        </div>
      </div>
    </div>
  );
};

export default ParagraphTaggingControls; 