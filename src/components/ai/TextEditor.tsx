import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader } from 'lucide-react';
import { useSuggestionStore } from '../../stores/suggestionStore';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { 
    suggestions, 
    isAnalyzing, 
    requestAnalysis,
    acceptSuggestion
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
    const newContent = 
      content.slice(0, suggestion.startIndex) +
      suggestion.suggestedText +
      content.slice(suggestion.endIndex);
    
    setContent(newContent);
    onContentChange?.(newContent);
    
    // Accept the suggestion
    await acceptSuggestion(suggestion.id);
  };

  const renderHighlightedText = () => {
    if (suggestions.length === 0 || !highlightsVisible) return content;

    const sortedSuggestions = [...suggestions].sort((a, b) => a.startIndex - b.startIndex);
    let highlightedContent = '';
    let lastIndex = 0;

    sortedSuggestions.forEach((suggestion) => {
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
        return 'bg-red-200 border-b-2 border-red-400 cursor-pointer';
      case 'clarity':
        return 'bg-yellow-200 border-b-2 border-yellow-400 cursor-pointer';
      case 'engagement':
        return 'bg-blue-200 border-b-2 border-blue-400 cursor-pointer';
      case 'grammar':
        return 'bg-orange-200 border-b-2 border-orange-400 cursor-pointer';
      default:
        return 'bg-gray-200 border-b-2 border-gray-400 cursor-pointer';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Document Editor</h2>
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
          className="absolute inset-4 pointer-events-none text-transparent whitespace-pre-wrap break-words overflow-hidden"
          style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            padding: '0',
            border: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: renderHighlightedText() }}
        />
        
        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing your document here..."
          className="w-full h-full p-4 resize-none border-none outline-none bg-transparent relative z-10"
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
    </div>
  );
};

export default TextEditor; 