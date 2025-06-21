import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Lightbulb, Sparkles, Type, Loader, Eye, EyeOff, MessageSquare, Layout, Brain, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSuggestionStore } from '../../stores/suggestionStore';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';
import { modificationTrackingService } from '../../services/modificationTrackingService';
import type { Suggestion, ModifiedArea } from '../../types/suggestion';

interface SuggestionsPanelProps {
  documentId: string;
  userId: string;
  content?: string; // Add content prop to enable paragraph tag filtering
  onSuggestionSelect?: (suggestion: Suggestion) => void;
  onSuggestionAccept?: (suggestion: Suggestion) => void;
  onToggleHighlights?: (visible: boolean) => void;
}

type TabType = 'correctness' | 'clarity' | 'engagement' | 'advanced';

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({ 
  documentId, 
  userId,
  content = '',
  onSuggestionSelect,
  onSuggestionAccept,
  onToggleHighlights
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('correctness');
  const [modifiedAreas, setModifiedAreas] = useState<ModifiedArea[]>([]);
  const [highlightsVisible, setHighlightsVisible] = useState<boolean>(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  
  const {
    suggestions,
    isLoading,
    isAnalyzing,
    error,
    acceptSuggestion,
    rejectSuggestion,
    getFilteredSuggestions,
  } = useSuggestionStore();

  const { tags } = useParagraphTagStore();

  // Load modified areas for filtering
  useEffect(() => {
    if (documentId && userId) {
      modificationTrackingService.getModifiedAreas(documentId, userId)
        .then(areas => {
          console.log('[SuggestionsPanel] Loaded modified areas:', areas);
          setModifiedAreas(areas);
        })
        .catch(error => console.error('[SuggestionsPanel] Error loading modified areas:', error));
    }
  }, [documentId, userId, suggestions.length]); // Refresh when suggestions change

  // First filter suggestions to exclude those from "Done" paragraphs
  const paragraphFilteredSuggestions = getFilteredSuggestions(content, tags);

  // Then filter to exclude over-modified areas
  const filteredSuggestions = paragraphFilteredSuggestions.filter(suggestion => {
    if (suggestion.type !== 'clarity' && suggestion.type !== 'engagement') {
      return true; // Always allow spelling/grammar
    }

    const shouldExclude = modificationTrackingService.shouldExcludeArea(
      suggestion.startIndex,
      suggestion.endIndex,
      suggestion.type as 'clarity' | 'engagement',
      modifiedAreas
      // No max iterations specified - will use defaults: 1 for engagement, 2 for clarity
    );

    if (shouldExclude) {
      console.log(`[SuggestionsPanel] Frontend filtering out ${suggestion.type} suggestion: "${suggestion.originalText}"`);
    }

    return !shouldExclude;
  });

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
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  // Group filtered suggestions by tab categories
  const categorizedSuggestions = {
    correctness: filteredSuggestions.filter(s => s.type === 'grammar' || s.type === 'spelling'),
    clarity: filteredSuggestions.filter(s => s.type === 'clarity'),
    engagement: filteredSuggestions.filter(s => s.type === 'engagement'),
    advanced: filteredSuggestions.filter(s => s.type === 'tone' || s.type === 'structure' || s.type === 'depth' || s.type === 'vocabulary')
  };

  // Show structure suggestions count in the advanced tab
  const structureSuggestionsCount = categorizedSuggestions.advanced.filter(s => s.type === 'structure').length;

  // Get the suggestions for the currently active tab
  const activeSuggestions = categorizedSuggestions[activeTab];

  // Group active suggestions by type for display
  const groupedActiveSuggestions = activeSuggestions.reduce((acc, suggestion) => {
    const type = suggestion.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(suggestion);
    return acc;
  }, {} as Record<string, Suggestion[]>);

  const handleAccept = async (suggestion: Suggestion) => {
    try {
      console.log('SuggestionsPanel: handleAccept called for:', suggestion.originalText);
      
      // Call the parent component's accept handler first
      if (onSuggestionAccept) {
        console.log('SuggestionsPanel: Calling parent onSuggestionAccept');
        onSuggestionAccept(suggestion);
      }
      
      // Then update the suggestion status
      console.log('SuggestionsPanel: Calling acceptSuggestion store method');
      await acceptSuggestion(suggestion.id);
      
      // Refresh modified areas after accepting a clarity/engagement suggestion
      if ((suggestion.type === 'clarity' || suggestion.type === 'engagement') && documentId && userId) {
        console.log('SuggestionsPanel: Refreshing modified areas after accepting suggestion');
        const updatedAreas = await modificationTrackingService.getModifiedAreas(documentId, userId);
        setModifiedAreas(updatedAreas);
      }
      
      console.log('SuggestionsPanel: Suggestion accepted successfully');
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  };

  const handleReject = async (suggestionId: string) => {
    try {
      await rejectSuggestion(suggestionId);
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
    }
  };

  const toggleHighlights = () => {
    const newVisibility = !highlightsVisible;
    setHighlightsVisible(newVisibility);
    if (onToggleHighlights) {
      onToggleHighlights(newVisibility);
    }
  };

  // Check scroll position and update navigation arrows
  const checkScrollPosition = () => {
    if (tabsScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsScrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  // Scroll tabs left
  const scrollTabsLeft = () => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: -100, behavior: 'smooth' });
    }
  };

  // Scroll tabs right
  const scrollTabsRight = () => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: 100, behavior: 'smooth' });
    }
  };

  // Check scroll position on mount and when tabs change
  useEffect(() => {
    checkScrollPosition();
    const handleResize = () => checkScrollPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [categorizedSuggestions]);

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'correctness':
        return <AlertTriangle className="w-4 h-4" />;
      case 'clarity':
        return <Lightbulb className="w-4 h-4" />;
      case 'engagement':
        return <Sparkles className="w-4 h-4" />;
      case 'advanced':
        return <Brain className="w-4 h-4" />;
    }
  };

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case 'correctness':
        return 'Correctness';
      case 'clarity':
        return 'Clarity';
      case 'engagement':
        return 'Engagement';
      case 'advanced':
        return 'Advanced';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading suggestions...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">AI Suggestions</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleHighlights}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                highlightsVisible
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={highlightsVisible ? 'Hide highlights' : 'Show highlights'}
            >
              {highlightsVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span className="hidden sm:inline">
                {highlightsVisible ? 'Hide' : 'Show'} Highlights
              </span>
            </button>
            {isAnalyzing && (
              <div className="flex items-center text-sm text-gray-600">
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </div>
            )}
          </div>
        </div>
        
        {filteredSuggestions.length > 0 && (
          <div className="mt-1">
            <p className="text-sm text-gray-600">
              {filteredSuggestions.length} suggestion{filteredSuggestions.length !== 1 ? 's' : ''} found
              {suggestions.length !== filteredSuggestions.length && (
                <span className="text-xs text-gray-500"> ({suggestions.length - filteredSuggestions.length} filtered out)</span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Areas modified 1+ times for clarity/engagement won't receive new suggestions.
              Use the toggle above to hide/show highlights in the editor.
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <div className="relative flex items-center">
          {/* Left scroll arrow */}
          {canScrollLeft && (
            <button
              onClick={scrollTabsLeft}
              className="absolute left-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-r from-white to-transparent hover:from-gray-50"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          
          {/* Scrollable tabs container */}
          <div 
            ref={tabsScrollRef}
            className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex-1"
            onScroll={checkScrollPosition}
          >
            <nav className="flex min-w-max">
              {(['correctness', 'clarity', 'engagement', 'advanced'] as TabType[]).map((tab) => {
                const count = categorizedSuggestions[tab].length;
                const isActive = activeTab === tab;
                
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center justify-center gap-1 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-w-[80px] ${
                      isActive
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {getTabIcon(tab)}
                    <span className="hidden sm:inline">{getTabLabel(tab)}</span>
                    <span className="sm:hidden">{getTabLabel(tab).slice(0, 4)}</span>
                    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full ml-1 ${
                      isActive
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Right scroll arrow */}
          {canScrollRight && (
            <button
              onClick={scrollTabsRight}
              className="absolute right-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-l from-white to-transparent hover:from-gray-50"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSuggestions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg font-medium mb-2">No {getTabLabel(activeTab).toLowerCase()} suggestions</p>
            <p className="text-sm">
              {activeTab === 'correctness' && 'No grammar or spelling issues found'}
              {activeTab === 'clarity' && 'Your writing is clear and easy to understand'}
              {activeTab === 'engagement' && 'Your content is engaging as-is'}
              {activeTab === 'advanced' && structureSuggestionsCount > 0 && 'Structure analysis complete - see suggestions below'}
              {activeTab === 'advanced' && structureSuggestionsCount === 0 && 'Your writing meets the advanced criteria for tone, structure, depth, and vocabulary'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(groupedActiveSuggestions).map(([type, typeSuggestions]) => (
              <div key={type} className="space-y-3">
                <div className="flex items-center gap-2">
                  {getSuggestionIcon(type as Suggestion['type'])}
                  <h3 className="font-medium text-gray-900 capitalize">
                    {type} ({typeSuggestions.length})
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {typeSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`border-l-4 rounded-r-lg p-4 cursor-pointer hover:shadow-sm transition-shadow ${getSeverityColor(suggestion.severity)}`}
                      onClick={() => onSuggestionSelect?.(suggestion)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white text-gray-600">
                            {suggestion.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="text-sm mb-1">
                          <span className="font-medium text-gray-700">Original:</span>
                          <span className="ml-2 bg-red-100 px-1 rounded">
                            "{suggestion.originalText}"
                          </span>
                        </div>
                        <div className="text-sm mb-1">
                          <span className="font-medium text-gray-700">Suggested:</span>
                          <span className="ml-2 bg-green-100 px-1 rounded">
                            "{suggestion.suggestedText}"
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Rule:</span>
                          <span className="ml-2 bg-blue-100 px-2 py-1 rounded text-blue-800 text-xs font-medium">
                            {suggestion.grammarRule || `${suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)} ${suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1)}`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(suggestion);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Accept
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(suggestion.id);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsPanel; 