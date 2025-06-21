import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader, Filter, AlertCircle, CheckCircle } from 'lucide-react';
import { useSuggestionStore } from '../../stores/suggestionStore';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';
import { paragraphTagService } from '../../services/paragraphTagService';
import SuggestionTooltip from './SuggestionTooltip';
import ParagraphTagger from './ParagraphTagger';
import type { Suggestion } from '../../types/suggestion';

interface TextEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  selectedSuggestion?: Suggestion | null;
  userId?: string;
  highlightsVisible?: boolean;
  onTagsChange?: () => void;
}

const TextEditor: React.FC<TextEditorProps> = ({
  documentId,
  initialContent = '',
  onContentChange,
  selectedSuggestion,
  userId = 'demo-user',
  highlightsVisible = true,
  onTagsChange
}) => {
  const [content, setContent] = useState(initialContent);
  const [isTyping, setIsTyping] = useState(false);
  const [tooltipSuggestion, setTooltipSuggestion] = useState<Suggestion | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [hasAISuggestions, setHasAISuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { 
    suggestions, 
    isAnalyzing, 
    requestAnalysis,
    acceptSuggestion,
    rejectSuggestion
  } = useSuggestionStore();

  const {
    tags,
    filteredByTag,
    loadTags,
    validateTags,
    getFilteredTags,
    setFilter
  } = useParagraphTagStore();

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
    // Reset AI suggestions flag when content changes externally
    setHasAISuggestions(false);
  }, [initialContent]);

  // Update hasAISuggestions when suggestions are received
  useEffect(() => {
    setHasAISuggestions(suggestions.length > 0);
  }, [suggestions]);

  // Load tags when document or user changes
  useEffect(() => {
    if (documentId && documentId !== 'new' && userId) {
      loadTags(documentId, userId);
    }
  }, [documentId, userId, loadTags]);

  // Validate tags when content changes
  useEffect(() => {
    if (content && documentId && documentId !== 'new' && userId && tags.length > 0) {
      const timeoutId = setTimeout(() => {
        validateTags(documentId, userId, content);
      }, 1000); // Debounce validation
      
      return () => clearTimeout(timeoutId);
    }
  }, [content, documentId, userId, validateTags, tags.length]);

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

  // Scroll to selected suggestion with improved highlighting
  useEffect(() => {
    if (selectedSuggestion) {
      console.log('Selected suggestion changed:', selectedSuggestion);
      
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.focus();
        
        // Try to find the suggestion text in current content
        const actualIndex = content.indexOf(selectedSuggestion.originalText);
        if (actualIndex !== -1) {
          // Use the found index instead of the stored one
          textarea.setSelectionRange(actualIndex, actualIndex + selectedSuggestion.originalText.length);
        } else {
          // Fallback to stored indices
          textarea.setSelectionRange(selectedSuggestion.startIndex, selectedSuggestion.endIndex);
        }
      }
    }
  }, [selectedSuggestion, content]);

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

    console.log('Rendering highlights for', suggestions.length, 'suggestions');

    // Create a more robust suggestion validation
    const validatedSuggestions = suggestions.map(suggestion => {
      // First, try the original indices
      const textAtOriginalIndices = content.slice(suggestion.startIndex, suggestion.endIndex);
      
      if (textAtOriginalIndices === suggestion.originalText) {
        console.log(`✓ Suggestion "${suggestion.originalText}" valid at original position`);
        return suggestion;
      }
      
      // If original indices don't work, try to find the text in the content
      const actualIndex = content.indexOf(suggestion.originalText);
      if (actualIndex !== -1) {
        console.log(`✓ Suggestion "${suggestion.originalText}" found at position ${actualIndex} (was ${suggestion.startIndex})`);
        return {
          ...suggestion,
          startIndex: actualIndex,
          endIndex: actualIndex + suggestion.originalText.length
        };
      }
      
      console.log(`✗ Suggestion "${suggestion.originalText}" not found in current content`);
      return null;
    }).filter(s => s !== null) as Suggestion[];

    // Filter out suggestions from "Done" paragraphs only if we have tags
    let finalSuggestions = validatedSuggestions;
    if (tags && tags.length > 0) {
      try {
        const paragraphs = paragraphTagService.extractParagraphs(content);
        const doneParagraphs = tags
          .filter(tag => tag.tagType === 'done')
          .map(tag => tag.paragraphIndex);
        
        if (doneParagraphs.length > 0) {
          finalSuggestions = validatedSuggestions.filter(suggestion => {
            for (let i = 0; i < paragraphs.length; i++) {
              if (doneParagraphs.includes(i)) {
                const paragraph = paragraphs[i];
                if (suggestion.startIndex >= paragraph.startIndex && 
                    suggestion.endIndex <= paragraph.endIndex) {
                  console.log(`Filtering out suggestion from "Done" paragraph: "${suggestion.originalText}"`);
                  return false;
                }
              }
            }
            return true;
          });
        }
      } catch (error) {
        console.warn('Error filtering by paragraph tags, showing all suggestions:', error);
      }
    }

    console.log(`Final suggestions to highlight: ${finalSuggestions.length}/${suggestions.length}`);

    if (finalSuggestions.length === 0) return content;

    // Sort suggestions by start index and render highlights
    const sortedSuggestions = finalSuggestions.sort((a, b) => a.startIndex - b.startIndex);
    let highlightedContent = '';
    let lastIndex = 0;

    sortedSuggestions.forEach((suggestion) => {
      // Skip overlapping suggestions
      if (suggestion.startIndex < lastIndex) {
        console.log(`Skipping overlapping suggestion: "${suggestion.originalText}"`);
        return;
      }
      
      // Skip out-of-bounds suggestions
      if (suggestion.startIndex >= content.length || suggestion.endIndex > content.length) {
        console.log(`Skipping out-of-bounds suggestion: "${suggestion.originalText}"`);
        return;
      }
      
      // Add text before suggestion
      const beforeText = content.slice(lastIndex, suggestion.startIndex);
      highlightedContent += escapeHtml(beforeText);
      
      // Add highlighted suggestion text with special styling for selected suggestion
      const suggestionText = content.slice(suggestion.startIndex, suggestion.endIndex);
      const isSelected = selectedSuggestion?.id === suggestion.id;
      const baseColorClass = getSuggestionHighlightColor(suggestion.type);
      const selectedClass = isSelected ? getSuggestionSelectedHighlightColor(suggestion.type) : baseColorClass;
      const colorClass = selectedClass;
      
      highlightedContent += `<span class="${colorClass}" data-suggestion-id="${suggestion.id}">${escapeHtml(suggestionText)}</span>`;
      
      lastIndex = suggestion.endIndex;
    });

    // Add remaining text
    const remainingText = content.slice(lastIndex);
    highlightedContent += escapeHtml(remainingText);
    
    return highlightedContent;
  };

  // Helper function to escape HTML characters
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      case 'tone':
        return 'bg-purple-200 bg-opacity-30 border-b-2 border-purple-400 cursor-pointer hover:bg-opacity-50';
      case 'structure':
        return 'bg-green-200 bg-opacity-30 border-b-2 border-green-400 cursor-pointer hover:bg-opacity-50';
      case 'depth':
        return 'bg-indigo-200 bg-opacity-30 border-b-2 border-indigo-400 cursor-pointer hover:bg-opacity-50';
      case 'vocabulary':
        return 'bg-pink-200 bg-opacity-30 border-b-2 border-pink-400 cursor-pointer hover:bg-opacity-50';
      default:
        return 'bg-gray-200 bg-opacity-30 border-b-2 border-gray-400 cursor-pointer hover:bg-opacity-50';
    }
  };

  const getSuggestionSelectedHighlightColor = (type: Suggestion['type']) => {
    switch (type) {
      case 'spelling':
        return 'bg-red-400 bg-opacity-80 border-b-2 border-red-600 cursor-pointer shadow-lg';
      case 'clarity':
        return 'bg-yellow-400 bg-opacity-80 border-b-2 border-yellow-600 cursor-pointer shadow-lg';
      case 'engagement':
        return 'bg-blue-400 bg-opacity-80 border-b-2 border-blue-600 cursor-pointer shadow-lg';
      case 'grammar':
        return 'bg-orange-400 bg-opacity-80 border-b-2 border-orange-600 cursor-pointer shadow-lg';
      case 'tone':
        return 'bg-purple-400 bg-opacity-80 border-b-2 border-purple-600 cursor-pointer shadow-lg';
      case 'structure':
        return 'bg-green-400 bg-opacity-80 border-b-2 border-green-600 cursor-pointer shadow-lg';
      case 'depth':
        return 'bg-indigo-400 bg-opacity-80 border-b-2 border-indigo-600 cursor-pointer shadow-lg';
      case 'vocabulary':
        return 'bg-pink-400 bg-opacity-80 border-b-2 border-pink-600 cursor-pointer shadow-lg';
      default:
        return 'bg-gray-400 bg-opacity-80 border-b-2 border-gray-600 cursor-pointer shadow-lg';
    }
  };

  const handleParagraphClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    
    // Check if we clicked on a suggestion span
    if (target.tagName === 'SPAN' && target.dataset.suggestionId) {
      const suggestionId = target.dataset.suggestionId;
      const clickedSuggestion = suggestions.find(s => s.id === suggestionId);
      
      if (clickedSuggestion) {
        // Show tooltip for this suggestion
        setTooltipSuggestion(clickedSuggestion);
        
        // Position tooltip relative to the clicked element
        const rect = target.getBoundingClientRect();
        const x = rect.left - 345; // 325px width + 20px gap
        const y = rect.top;
        
        setTooltipPosition({ x, y });
        setTooltipVisible(true);
        
        event.preventDefault();
        return;
      }
    }
    
    // Normal text click - hide tooltip
    if (tooltipVisible) {
      setTooltipVisible(false);
      setTooltipSuggestion(null);
    }
  };

  const renderParagraphWithHighlights = (paragraphText: string, paragraphStartIndex: number) => {
    if (!highlightsVisible || suggestions.length === 0) {
      return escapeHtml(paragraphText);
    }

    const paragraphEndIndex = paragraphStartIndex + paragraphText.length;
    console.log(`[Paragraph ${paragraphStartIndex}-${paragraphEndIndex}] Rendering with ${suggestions.length} suggestions`);

    // Find all suggestions that might be relevant to this paragraph
    const relevantSuggestions = suggestions.filter(suggestion => {
      // Check if suggestion overlaps with this paragraph
      const overlaps = suggestion.startIndex < paragraphEndIndex && suggestion.endIndex > paragraphStartIndex;
      
      // Also check if the suggestion text exists within this paragraph
      const existsInParagraph = paragraphText.includes(suggestion.originalText);
      
      return overlaps || existsInParagraph;
    });

    console.log(`[Paragraph ${paragraphStartIndex}] Found ${relevantSuggestions.length} relevant suggestions`);

    // Validate and correct suggestion positions
    const validSuggestions = relevantSuggestions.map(suggestion => {
      // Check if suggestion is at expected position
      const textAtPosition = content.slice(suggestion.startIndex, suggestion.endIndex);
      if (textAtPosition === suggestion.originalText) {
        return suggestion;
      }
      
      // Try to find the text in the global content
      const globalIndex = content.indexOf(suggestion.originalText);
      if (globalIndex !== -1) {
        return {
          ...suggestion,
          startIndex: globalIndex,
          endIndex: globalIndex + suggestion.originalText.length
        };
      }
      
      // Try to find within this specific paragraph
      const paragraphIndex = paragraphText.indexOf(suggestion.originalText);
      if (paragraphIndex !== -1) {
        const correctedStart = paragraphStartIndex + paragraphIndex;
        return {
          ...suggestion,
          startIndex: correctedStart,
          endIndex: correctedStart + suggestion.originalText.length
        };
      }
      
      return null;
    }).filter(s => s !== null) as Suggestion[];

    // Filter to only suggestions that actually fall within this paragraph
    const paragraphSuggestions = validSuggestions.filter(suggestion => 
      suggestion.startIndex >= paragraphStartIndex && 
      suggestion.endIndex <= paragraphEndIndex
    );

    console.log(`[Paragraph ${paragraphStartIndex}] Final paragraph suggestions: ${paragraphSuggestions.length}`);

    if (paragraphSuggestions.length === 0) {
      return escapeHtml(paragraphText);
    }

    // Sort by position and render highlights
    const sortedSuggestions = paragraphSuggestions.sort((a, b) => a.startIndex - b.startIndex);
    let highlightedContent = '';
    let lastIndex = paragraphStartIndex;

    sortedSuggestions.forEach((suggestion) => {
      // Add text before suggestion
      const beforeText = content.slice(lastIndex, suggestion.startIndex);
      highlightedContent += escapeHtml(beforeText);
      
      // Add highlighted suggestion text with selection emphasis
      const suggestionText = content.slice(suggestion.startIndex, suggestion.endIndex);
      const isSelected = selectedSuggestion?.id === suggestion.id;
      const colorClass = isSelected ? getSuggestionSelectedHighlightColor(suggestion.type) : getSuggestionHighlightColor(suggestion.type);
      
      highlightedContent += `<span class="${colorClass}" data-suggestion-id="${suggestion.id}">${escapeHtml(suggestionText)}</span>`;
      
      lastIndex = suggestion.endIndex;
    });

    // Add remaining paragraph text
    const remainingText = content.slice(lastIndex, paragraphEndIndex);
    highlightedContent += escapeHtml(remainingText);
    
    return highlightedContent;
  };

  const handleParagraphEdit = (paragraphIndex: number, newText: string) => {
    const paragraphs = paragraphTagService.extractParagraphs(content);
    let newContent = '';
    
    paragraphs.forEach((p, idx) => {
      if (idx === paragraphIndex) {
        newContent += newText;
      } else {
        newContent += p.text;
      }
      // Add paragraph separator if not the last paragraph
      if (idx < paragraphs.length - 1) {
        newContent += '\n\n';
      }
    });
    
    handleContentChange(newContent);
  };

  const renderParagraphsWithTags = () => {
    if (!content.trim()) {
      return (
        <div className="p-8 text-center text-gray-500">
          <p>Start writing to see your content here...</p>
        </div>
      );
    }

    const paragraphs = paragraphTagService.extractParagraphs(content);
    const filteredTags = getFilteredTags();
    
    return paragraphs.map((paragraph, index) => {
      const tag = tags.find(t => t.paragraphIndex === index);
      const isFiltered = filteredByTag && filteredByTag !== 'all';
      const shouldShow = !isFiltered || (tag && filteredTags.includes(tag));
      
      if (!shouldShow) return null;
      
      const hasTag = !!tag;
      const tagType = tag?.tagType;
      
      let paragraphBorderClass = '';
      if (hasTag) {
        paragraphBorderClass = tagType === 'needs-review' 
          ? 'border-l-4 border-yellow-400 bg-yellow-50' 
          : 'border-l-4 border-green-400 bg-green-50';
      }

      // Don't show suggestions for "Done" paragraphs
      const showSuggestions = !hasTag || tagType !== 'done';
      const paragraphContent = showSuggestions 
        ? renderParagraphWithHighlights(paragraph.text, paragraph.startIndex)
        : escapeHtml(paragraph.text);

      return (
        <div key={index} className={`mb-4 p-2 rounded-r-md ${paragraphBorderClass}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div 
                className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words cursor-text outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-1"
                contentEditable={true}
                suppressContentEditableWarning={true}
                dangerouslySetInnerHTML={{ __html: paragraphContent }}
                onClick={(e) => handleParagraphClick(e)}
                onInput={(e) => {
                  const target = e.target as HTMLDivElement;
                  const newText = target.textContent || '';
                  handleParagraphEdit(index, newText);
                }}
                onBlur={(e) => {
                  // Re-render with highlights after editing
                  const target = e.target as HTMLDivElement;
                  const newText = target.textContent || '';
                  if (newText !== paragraph.text) {
                    handleParagraphEdit(index, newText);
                  }
                }}
              />
              {tag?.note && (
                <p className="text-sm text-gray-600 mt-2 italic">
                  Note: {tag.note}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <ParagraphTagger
                documentId={documentId}
                userId={userId}
                content={content}
                paragraphIndex={index}
                onTagUpdate={onTagsChange}
              />
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  // Filter functions for paragraph tags
  const handleFilterChange = (filter: 'all' | 'needs-review' | 'done') => {
    setFilter(filter);
  };

  const getFilterButtonClass = (filterType: 'all' | 'needs-review' | 'done') => {
    const isActive = filteredByTag === filterType;
    const baseClass = 'px-2 py-1 text-xs font-medium rounded border transition-colors duration-200';
    
    if (isActive) {
      switch (filterType) {
        case 'needs-review':
          return `${baseClass} bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200`;
        case 'done':
          return `${baseClass} bg-green-100 border-green-300 text-green-800 hover:bg-green-200`;
        default:
          return `${baseClass} bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200`;
      }
    }
    
    return `${baseClass} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`;
  };

  const filteredTags = getFilteredTags();
  const needsReviewCount = tags.filter(tag => tag.tagType === 'needs-review').length;
  const doneCount = tags.filter(tag => tag.tagType === 'done').length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 min-h-[80px] max-h-[80px] overflow-hidden">
        <div className="flex-shrink-0 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Document Editor</h2>
          {suggestions.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Click on highlighted text to see detailed suggestions
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 min-w-0">
          {/* Filter Controls */}
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-600 flex-shrink-0">Filter:</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => handleFilterChange('all')}
                className={getFilterButtonClass('all')}
              >
                All ({tags.length})
              </button>
              <button
                onClick={() => handleFilterChange('needs-review')}
                className={getFilterButtonClass('needs-review')}
              >
                <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                Review ({needsReviewCount})
              </button>
              <button
                onClick={() => handleFilterChange('done')}
                className={getFilterButtonClass('done')}
              >
                <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                Done ({doneCount})
              </button>
            </div>
          </div>
          
          {/* Analyze Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
      </div>

      {/* Editor Content - Fixed height regardless of content */}
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto">
          <div className="p-4">
            {content.trim() && hasAISuggestions ? (
              <div className="max-w-4xl mx-auto min-h-[600px]">
                {renderParagraphsWithTags()}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto min-h-[600px]">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onClick={handleTextareaClick}
                  placeholder="Start writing your document here..."
                  className="w-full h-full p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 leading-relaxed"
                  style={{ minHeight: '500px' }}
                />
                {content.trim() && !hasAISuggestions && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      📝 Keep writing or click "Analyze Text" to get AI suggestions and see paragraphs with tagging features.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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