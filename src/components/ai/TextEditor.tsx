import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader } from 'lucide-react';
import { useSuggestionStore } from '../../stores/suggestionStore';
import SuggestionTooltip from './SuggestionTooltip';
import type { Suggestion } from '../../types/suggestion';

interface TextEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  selectedSuggestion?: Suggestion | null;
  userId?: string;
  highlightsVisible?: boolean;
}

const TextEditor: React.FC<TextEditorProps> = ({
  documentId,
  initialContent = '',
  onContentChange,
  selectedSuggestion,
  userId = 'demo-user',
  highlightsVisible = true
}) => {
  const [content, setContent] = useState(initialContent);
  const [isTyping, setIsTyping] = useState(false);
  const [tooltipSuggestion, setTooltipSuggestion] = useState<Suggestion | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { 
    suggestions, 
    isAnalyzing, 
    requestAnalysis,
    acceptSuggestion,
    rejectSuggestion
  } = useSuggestionStore();

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Handle escape key to close tooltip
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tooltipVisible) {
        setTooltipVisible(false);
        setTooltipSuggestion(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [tooltipVisible]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Scroll to selected suggestion
  useEffect(() => {
    if (selectedSuggestion && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(
        selectedSuggestion.startIndex,
        selectedSuggestion.endIndex
      );
    }
  }, [selectedSuggestion]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsTyping(true);
    onContentChange?.(newContent);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce analysis trigger
    debounceTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Auto-trigger analysis after user stops typing
      if (newContent.trim().length > 10) { // Only analyze if there's substantial content
        handleAutoAnalysis(newContent);
      }
    }, 2000); // Wait 2 seconds after user stops typing
  };

  const handleAutoAnalysis = async (content: string) => {
    if (!content.trim() || isAnalyzing) {
      console.log('Skipping auto-analysis:', { hasContent: !!content.trim(), isAnalyzing });
      return;
    }
    
    try {
      console.log('Starting auto-analysis...');
      await requestAnalysis({
        content,
        documentId,
        userId,
        analysisType: 'incremental' // Use incremental analysis for better performance
      });
      console.log('Auto-analysis completed');
    } catch (error) {
      console.error('Auto-analysis failed:', error);
      // Don't show error alerts for auto-analysis failures
    }
  };

  const handleAnalyzeClick = async () => {
    if (!content.trim()) return;
    
    if (isAnalyzing) {
      console.log('Analysis already in progress, skipping manual analysis');
      return;
    }
    
    // Clear any pending auto-analysis
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      console.log('Cleared pending auto-analysis');
    }
    
    try {
      console.log('Starting manual analysis...', { content, documentId, userId });
      await requestAnalysis({
        content,
        documentId,
        userId,
        analysisType: 'full'
      });
      console.log('Manual analysis completed successfully');
    } catch (error) {
      console.error('Failed to analyze content:', error);
      // Show more detailed error to user
      alert(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const applySuggestion = async (suggestion: Suggestion) => {
    // Verify the suggestion is still valid against current content
    const actualTextAtIndices = content.slice(suggestion.startIndex, suggestion.endIndex);
    let validStartIndex = suggestion.startIndex;
    let validEndIndex = suggestion.endIndex;
    
    if (actualTextAtIndices !== suggestion.originalText) {
      console.warn('TextEditor: Suggestion indices are stale, text has changed');
      console.log('Expected:', suggestion.originalText);
      console.log('Found at indices:', actualTextAtIndices);
      
      // Try to find the correct position of the original text
      const actualIndex = content.indexOf(suggestion.originalText);
      if (actualIndex === -1) {
        console.error('TextEditor: Original text not found in current content, cannot apply suggestion');
        
        // Reject this stale suggestion
        await rejectSuggestion(suggestion.id);
        return;
      }
      
      // Update to the correct indices
      validStartIndex = actualIndex;
      validEndIndex = actualIndex + suggestion.originalText.length;
      
      console.log('TextEditor: Found correct position', {
        oldStart: suggestion.startIndex,
        oldEnd: suggestion.endIndex,
        newStart: validStartIndex,
        newEnd: validEndIndex
      });
    }
    
    // Apply the suggestion using valid indices
    const newContent = 
      content.slice(0, validStartIndex) +
      suggestion.suggestedText +
      content.slice(validEndIndex);
    
    setContent(newContent);
    onContentChange?.(newContent);
    
    // Accept the suggestion
    await acceptSuggestion(suggestion.id);
  };

  const handleTextareaClick = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = event.target as HTMLTextAreaElement;
    const clickPosition = textarea.selectionStart;
    
    // Find suggestion that contains this click position
    // First validate suggestion indices to ensure accurate click detection
    const clickedSuggestion = suggestions.find(suggestion => {
      const actualTextAtIndices = content.slice(suggestion.startIndex, suggestion.endIndex);
      let validStartIndex = suggestion.startIndex;
      let validEndIndex = suggestion.endIndex;
      
      if (actualTextAtIndices !== suggestion.originalText) {
        // Indices are stale, try to find the correct position
        const actualIndex = content.indexOf(suggestion.originalText);
        if (actualIndex === -1) {
          return false; // Text not found, can't match this suggestion
        }
        validStartIndex = actualIndex;
        validEndIndex = actualIndex + suggestion.originalText.length;
      }
      
      // Check if click position is within the validated range
      return clickPosition >= validStartIndex && clickPosition <= validEndIndex;
    });
    
    if (clickedSuggestion) {
      // Show tooltip for this suggestion
      setTooltipSuggestion(clickedSuggestion);
      
      // Position tooltip to the left side of the text editor
      const rect = textarea.getBoundingClientRect();
      
      // Position to the left of the text editor area
      const x = rect.left - 345; // 325px width + 20px gap
      const y = rect.top + 20; // Slight offset from top
      
      setTooltipPosition({ x, y });
      setTooltipVisible(true);
      
      // Prevent default text selection behavior when clicking on suggestions
      event.preventDefault();
    } else {
      // Normal text click - hide tooltip and allow normal cursor positioning
      if (tooltipVisible) {
        setTooltipVisible(false);
        setTooltipSuggestion(null);
      }
      // Don't prevent default for normal text clicks
    }
  };

  const handleTooltipAccept = async () => {
    if (tooltipSuggestion) {
      await applySuggestion(tooltipSuggestion);
      setTooltipVisible(false);
      setTooltipSuggestion(null);
    }
  };

  const handleTooltipReject = async () => {
    if (tooltipSuggestion) {
      await rejectSuggestion(tooltipSuggestion.id);
      setTooltipVisible(false);
      setTooltipSuggestion(null);
    }
  };

  const renderHighlightedText = () => {
    if (suggestions.length === 0 || !highlightsVisible) return content;

    // Validate and fix suggestion indices before highlighting
    const validatedSuggestions = suggestions.map(suggestion => {
      const actualTextAtIndices = content.slice(suggestion.startIndex, suggestion.endIndex);
      
      if (actualTextAtIndices === suggestion.originalText) {
        // Indices are correct
        return suggestion;
      }
      
      // Indices are stale, try to find the correct position
      const actualIndex = content.indexOf(suggestion.originalText);
      if (actualIndex !== -1) {
        // Found the text at a different position
        return {
          ...suggestion,
          startIndex: actualIndex,
          endIndex: actualIndex + suggestion.originalText.length
        };
      }
      
      // Text not found, mark as invalid
      return null;
    }).filter(s => s !== null) as Suggestion[];

    const sortedSuggestions = validatedSuggestions.sort((a, b) => a.startIndex - b.startIndex);
    let highlightedContent = '';
    let lastIndex = 0;

    sortedSuggestions.forEach((suggestion) => {
      // Ensure we don't have overlapping suggestions
      if (suggestion.startIndex < lastIndex) {
        return; // Skip overlapping suggestions
      }
      
      // Add text before suggestion
      highlightedContent += content.slice(lastIndex, suggestion.startIndex);
      
      // Add highlighted suggestion text
      const suggestionText = content.slice(suggestion.startIndex, suggestion.endIndex);
      const colorClass = getSuggestionHighlightColor(suggestion.type);
      highlightedContent += `<span class="${colorClass}" data-suggestion-id="${suggestion.id}">${suggestionText}</span>`;
      
      lastIndex = suggestion.endIndex;
    });

    // Add remaining text
    highlightedContent += content.slice(lastIndex);
    
    return highlightedContent;
  };

  const getSuggestionHighlightColor = (type: Suggestion['type']) => {
    switch (type) {
      case 'spelling':
        return 'bg-red-200 bg-opacity-30 border-b-2 border-red-400 cursor-pointer hover:bg-opacity-50';
      case 'clarity':
        return 'bg-yellow-200 bg-opacity-30 border-b-2 border-yellow-400 cursor-pointer hover:bg-opacity-50';
      case 'engagement':
        return 'bg-blue-200 bg-opacity-30 border-b-2 border-blue-400 cursor-pointer hover:bg-opacity-50';
      case 'grammar':
        return 'bg-orange-200 bg-opacity-30 border-b-2 border-orange-400 cursor-pointer hover:bg-opacity-50';
      default:
        return 'bg-gray-200 bg-opacity-30 border-b-2 border-gray-400 cursor-pointer hover:bg-opacity-50';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Document Editor</h2>
          {suggestions.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Click on highlighted text to see detailed suggestions
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isTyping && (
            <span className="text-xs text-gray-500 flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse mr-2"></div>
              Typing...
            </span>
          )}
          <button
            onClick={handleAnalyzeClick}
            disabled={isAnalyzing || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'Analyze Text'}
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative">
        {/* Background highlighting layer */}
        <div 
          className="absolute inset-4 text-transparent whitespace-pre-wrap break-words overflow-hidden select-none"
          style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            padding: '0',
            border: 'none',
            pointerEvents: 'none',
            zIndex: 1,
          }}
          dangerouslySetInnerHTML={{ __html: renderHighlightedText() }}
        />
        
        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onClick={handleTextareaClick}
          placeholder="Start writing your document here..."
          className="w-full h-full p-4 resize-none border-none outline-none bg-transparent relative z-2"
          style={{
            minHeight: 'calc(100vh - 200px)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            lineHeight: '1.6',
          }}
        />
      </div>

      {/* Quick suggestion actions */}
      {selectedSuggestion && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-1">
                {selectedSuggestion.type.charAt(0).toUpperCase() + selectedSuggestion.type.slice(1)} Suggestion
              </p>
              <p className="text-sm text-gray-600 mb-2">
                {selectedSuggestion.explanation}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>
                  Replace: <span className="bg-red-100 px-1 rounded">"{selectedSuggestion.originalText}"</span>
                </span>
                <span>
                  With: <span className="bg-green-100 px-1 rounded">"{selectedSuggestion.suggestedText}"</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => applySuggestion(selectedSuggestion)}
              className="ml-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Suggestion Tooltip */}
      {tooltipSuggestion && (
        <SuggestionTooltip
          suggestion={tooltipSuggestion}
          isVisible={tooltipVisible}
          position={tooltipPosition}
          onAccept={handleTooltipAccept}
          onReject={handleTooltipReject}
        />
      )}
    </div>
  );
};

export default TextEditor; 