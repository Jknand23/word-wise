import React, { useState } from 'react';
import { Tag, AlertCircle, CheckCircle, X, Filter as FilterIcon } from 'lucide-react';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';

interface ControlsProps { documentId: string; userId: string; }

const ParagraphTaggingControls: React.FC<ControlsProps> = ({ documentId, userId }) => {
  const {
    tags,
    filteredByTag,
    setFilter,
    clearAllTags,
    isLoading,
    error
  } = useParagraphTagStore();

  const [showError, setShowError] = useState(true);

  const needsReviewCount = tags.filter(tag => tag.tagType === 'needs-review').length;
  const doneCount = tags.filter(tag => tag.tagType === 'done').length;

  const handleDismissError = () => {
    setShowError(false);
  };

  const handleReset = async () => {
    try {
      await clearAllTags(documentId, userId);
    } catch (error) {
      console.error('Error resetting tags:', error);
    }
  };

  const baseButtonClass = 'px-3 h-7 text-xs font-semibold rounded-full transition-colors duration-200 whitespace-nowrap flex items-center shadow-sm';

  const getFilterButtonClass = (tagType: 'all' | 'needs-review' | 'done') => {
    const inactive = `${baseButtonClass} bg-gray-100 text-gray-600 hover:bg-gray-200`;
    const activeMap: Record<string,string> = {
      'all': `${baseButtonClass} bg-blue-600 text-white`,
      'needs-review': `${baseButtonClass} bg-yellow-500 text-white`,
      'done': `${baseButtonClass} bg-green-600 text-white`,
    };
    return filteredByTag === tagType ? activeMap[tagType] : inactive;
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

      {/* Header Row with Title, Filters, and Reset */}
      <div className="flex flex-wrap items-center gap-3">
        <Tag className="w-4 h-4 text-gray-600" />
        <h3 className="text-sm font-medium text-gray-700">Paragraph Tags</h3>
        {isLoading && <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />}

        {/* Filters */}
        <FilterIcon className="w-4 h-4 text-gray-400 ml-2" />
        <button onClick={() => setFilter('all')} className={getFilterButtonClass('all')}>
          All ({tags.length})
        </button>
        <button onClick={() => setFilter('needs-review')} className={getFilterButtonClass('needs-review')}>
          <AlertCircle className="w-3 h-3 mr-1" /> Review ({needsReviewCount})
        </button>
        <button onClick={() => setFilter('done')} className={getFilterButtonClass('done')}>
          <CheckCircle className="w-3 h-3 mr-1" /> Done ({doneCount})
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="ml-auto px-3 h-7 text-xs font-semibold rounded-full border bg-red-50 border-red-300 text-red-600 hover:bg-red-100 whitespace-nowrap"
          disabled={tags.length === 0}
        >
          Reset Tags
        </button>
      </div>

      {/* Tag Statistics */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
        <span>{tags.length} total</span>
        <span>{needsReviewCount} need review</span>
        <span>{doneCount} done</span>
      </div>
    </div>
  );
};

export default ParagraphTaggingControls; 