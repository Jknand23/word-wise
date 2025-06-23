import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader, Filter, AlertCircle, CheckCircle } from 'lucide-react';
import { useSuggestionStore } from '../../stores/suggestionStore';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';
import { paragraphTagService } from '../../services/paragraphTagService';
import SuggestionTooltip from './SuggestionTooltip';
import ParagraphTagger from './ParagraphTagger';
import type { Suggestion, EssaySection } from '../../types/suggestion';

interface TextEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  selectedSuggestion?: Suggestion | null;
  selectedSection?: EssaySection | null;
  userId?: string;
  highlightsVisible?: boolean;
  onTagsChange?: () => void;
}

const TextEditor: React.FC<TextEditorProps> = ({
  documentId,
  initialContent = '',
  onContentChange,
  selectedSuggestion,
  selectedSection = null,
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
  const [scrollTop, setScrollTop] = useState(0);
  const [paragraphBoundaries, setParagraphBoundaries] = useState<Array<{
    index: number;
    startPos: number;
    endPos: number;
    text: string;
    actualTop: number;
  }>>([]);
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
    setFilter,
    clearAllTags
  } = useParagraphTagStore();

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Update paragraph boundaries when content changes
  useEffect(() => {
    const updateBoundaries = () => {
      if (content.trim()) {
        // Use setTimeout to ensure DOM is updated and textarea is rendered
        setTimeout(() => {
          const boundaries = calculateParagraphBoundaries(content);
          setParagraphBoundaries(boundaries);
        }, 100); // Give more time for textarea to fully render
      } else {
        setParagraphBoundaries([]);
      }
    };
    
    updateBoundaries();
  }, [content]);

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

  // Scroll to selected essay section
  useEffect(() => {
    if (selectedSection && textareaRef.current) {
      const textarea = textareaRef.current;

      // Attempt to find exact position of section text to handle index mismatches
      const sectionText = selectedSection.text.trim();
      let actualIndex = -1;

      if (sectionText.length > 0) {
        // Find all occurrences, pick closest to original startIndex
        const occurrences: number[] = [];
        let searchIdx = content.indexOf(sectionText);
        while (searchIdx !== -1) {
          occurrences.push(searchIdx);
          searchIdx = content.indexOf(sectionText, searchIdx + 1);
        }
        if (occurrences.length === 1) {
          actualIndex = occurrences[0];
        } else if (occurrences.length > 1) {
          // Choose occurrence closest to provided startIndex
          actualIndex = occurrences.reduce((prev, curr) => (
            Math.abs(curr - selectedSection.startIndex) < Math.abs(prev - selectedSection.startIndex) ? curr : prev
          ), occurrences[0]);
        }
      }

      if (actualIndex === -1) {
        // Fallback to provided startIndex
        actualIndex = selectedSection.startIndex;
      }

      const endIndex = actualIndex + sectionText.length;

      // Apply selection
      textarea.focus();
      textarea.setSelectionRange(actualIndex, endIndex);

      // Scroll container to reveal section near top
      const topPos = getCharacterPosition(actualIndex);
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: Math.max(0, topPos - 40),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedSection]);

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

  /**
   * Trigger content analysis from the UI button.
   *
   * Manual click now ALWAYS runs a **FULL** document analysis for the most
   * comprehensive feedback. Incremental / differential analysis is confined to
   * automatic background runs that occur after typing pauses or suggestion
   * acceptance.
   */
  const handleAnalyzeClick = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!content.trim()) return;

    if (isAnalyzing) {
      console.log('Analysis already in progress, skipping manual analysis');
      return;
    }

    // Manual analysis should now **always** run a FULL document analysis.
    // Incremental (quick) analysis is reserved for automatic background runs.

    // Clear any pending auto-analysis timers so we don't queue a duplicate incremental run.
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      console.log('Cleared pending auto-analysis');
    }

    try {
      console.log('Starting FULL analysis...', { contentLength: content.length, documentId, userId });
      await requestAnalysis({
        content,
        documentId,
        userId,
        analysisType: 'full',
        bypassCache: true,
      });
      console.log('Manual analysis completed successfully');
      
      // 🔍 DEBUG: Wait a moment and check what's in Firestore
      setTimeout(async () => {
        console.log('🔍 [DEBUG] Auto-checking Firestore 3 seconds after analysis...');
        try {
          const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
          const { db } = await import('../../lib/firebase');

          // Test both queries to compare results
          const qAll = query(
            collection(db, 'suggestions'),
            where('documentId', '==', documentId),
            where('userId', '==', userId)
          );
          
          const qPending = query(
            collection(db, 'suggestions'),
            where('documentId', '==', documentId),
            where('userId', '==', userId),
            where('status', '==', 'pending'),
            orderBy('startIndex', 'asc')
          );

          // Test all suggestions query
          const snapshotAll = await getDocs(qAll);
          console.log('🔍 [DEBUG] All suggestions query results:', {
            totalDocs: snapshotAll.docs.length,
            docs: snapshotAll.docs.slice(0, 3).map(doc => {
              const data = doc.data() as any;
              return {
                id: doc.id, 
                status: data.status,
                originalText: data.originalText,
                type: data.type,
                createdAt: data.createdAt
              };
            })
          });

          // Test pending suggestions query (same as subscription)
          try {
            const snapshotPending = await getDocs(qPending);
            console.log('🔍 [DEBUG] Pending suggestions query results (same as subscription):', {
              totalDocs: snapshotPending.docs.length,
              docs: snapshotPending.docs.slice(0, 3).map(doc => {
                const data = doc.data() as any;
                return {
                  id: doc.id, 
                  status: data.status,
                  originalText: data.originalText,
                  type: data.type,
                  createdAt: data.createdAt
                };
              })
            });
          } catch (error) {
            console.error('🔍 [DEBUG] Pending query FAILED (same error as subscription?):', error);
          }
        } catch (error) {
          console.error('🔍 [DEBUG] Auto-check Firestore error:', error);
        }
      }, 3000);
      
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
                content={paragraph.text}
                fullDocumentContent={content}
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
    const baseClass = 'px-3 h-7 text-xs font-semibold rounded-full transition-colors duration-200 whitespace-nowrap flex items-center';
    
    if (isActive) {
      switch (filterType) {
        case 'needs-review':
          return `${baseClass} bg-yellow-500 text-white shadow-sm`;
        case 'done':
          return `${baseClass} bg-green-600 text-white shadow-sm`;
        default:
          return `${baseClass} bg-blue-600 text-white shadow-sm`;
      }
    }
    
    return `${baseClass} bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent`;
  };

  const filteredTags = getFilteredTags();
  const needsReviewCount = tags.filter(tag => tag.tagType === 'needs-review').length;
  const doneCount = tags.filter(tag => tag.tagType === 'done').length;

  // Calculate paragraph boundaries for tag positioning
  const calculateParagraphBoundaries = (text: string) => {
    if (!text.trim()) return [];
    
    const boundaries: Array<{
      index: number;
      startPos: number;
      endPos: number;
      text: string;
      actualTop: number;
    }> = [];
    
    // Split by double newlines to get paragraphs
    const paragraphSections = text.split('\n\n');
    let currentPosition = 0;
    let paragraphIndex = 0;
    
    paragraphSections.forEach((section, sectionIndex) => {
      const trimmedSection = section.trim();
      if (trimmedSection) {
        // Find the actual start position in the original text
        const startPos = currentPosition;
        const endPos = currentPosition + section.length;
        
        // Get actual position using textarea's coordinate system
        const actualTop = getCharacterPosition(startPos);
        
        boundaries.push({
          index: paragraphIndex,
          startPos,
          endPos,
          text: trimmedSection,
          actualTop
        });
        
        paragraphIndex++;
      }
      
      // Move position forward by section length + separator length
      currentPosition += section.length;
      if (sectionIndex < paragraphSections.length - 1) {
        currentPosition += 2; // Add 2 for '\n\n'
      }
    });
    
    return boundaries;
  };

  // Get actual pixel position of a character in the textarea
  const getCharacterPosition = (charIndex: number): number => {
    if (!textareaRef.current) {
      // Fallback to simple calculation if textarea not available
      const textUpToChar = content.substring(0, charIndex);
      const linesBefore = (textUpToChar.match(/\n/g) || []).length;
      const computedLineHeight = parseFloat(window.getComputedStyle(textareaRef.current!).lineHeight || '24');
      const computedPadding = parseFloat(window.getComputedStyle(textareaRef.current!).paddingTop || '16');
      return linesBefore * computedLineHeight + computedPadding;
    }
    
    const textarea = textareaRef.current;
    
    try {
      // Create a temporary div to measure text position
      const measureDiv = document.createElement('div');
      const cs = window.getComputedStyle(textarea);

      // Mirror the textarea styles as closely as possible
      measureDiv.style.position = 'absolute';
      measureDiv.style.visibility = 'hidden';
      measureDiv.style.whiteSpace = 'pre-wrap';
      measureDiv.style.wordWrap = 'break-word';
      measureDiv.style.font = cs.font;
      measureDiv.style.lineHeight = cs.lineHeight;
      measureDiv.style.letterSpacing = cs.letterSpacing;
      measureDiv.style.boxSizing = 'border-box';

      // Match the exact inner width of the textarea (including padding)
      measureDiv.style.width = `${textarea.clientWidth}px`;
      measureDiv.style.padding = cs.padding;
      measureDiv.style.border = 'none';
      measureDiv.style.maxWidth = `${textarea.clientWidth}px`;
      measureDiv.style.fontFamily = cs.fontFamily;
      
      // Add text up to the character position
      const textUpToChar = content.substring(0, charIndex);
      measureDiv.textContent = textUpToChar;
      
      document.body.appendChild(measureDiv);
      const height = measureDiv.offsetHeight;
      document.body.removeChild(measureDiv);
      
      const paddingTop = parseFloat(cs.paddingTop || '0');
      return Math.max(0, height - paddingTop); // Subtract top padding, ensure non-negative
    } catch (error) {
      console.error('Error calculating character position:', error);
      // Fallback to simple calculation
      const textUpToChar = content.substring(0, charIndex);
      const linesBefore = (textUpToChar.match(/\n/g) || []).length;
      const computedLineHeight = parseFloat(window.getComputedStyle(textareaRef.current!).lineHeight || '24');
      const computedPadding = parseFloat(window.getComputedStyle(textareaRef.current!).paddingTop || '16');
      return linesBefore * computedLineHeight + computedPadding;
    }
  };

  // Handle container scroll to update tag positions
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  };

  // Auto-scroll to first matching paragraph when filter changes
  useEffect(() => {
    if (filteredByTag && filteredByTag !== 'all' && paragraphBoundaries.length > 0) {
      const matchingTagType = filteredByTag;
      const matchingTag = tags.find(t => t.tagType === matchingTagType);
      if (matchingTag) {
        const matchingBoundary = paragraphBoundaries.find(b => b.index === matchingTag.paragraphIndex);
        if (matchingBoundary && containerRef.current) {
          containerRef.current.scrollTo({
            top: Math.max(0, matchingBoundary.actualTop - 40),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [filteredByTag]);

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
        <div className="flex items-center gap-4 ml-auto">
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
              title="Analyze the entire document for writing suggestions"
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

      {/* Editor Content - Unified Text Area with Overlay Tags */}
      <div className="flex-1 min-h-0">
        <div 
          ref={containerRef}
          className="h-full overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="max-w-4xl mx-auto p-4 relative">
            {/* Main Unified Textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onClick={handleTextareaClick}
                placeholder="Start writing your document here..."
                className="w-full p-4 pr-20 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 leading-relaxed overflow-hidden font-sans"
                style={{ 
                  minHeight: '500px',
                  height: 'auto',
                  lineHeight: '1.5'
                }}
                rows={Math.max(20, content.split('\n').length + 5)}
              />
              
              {/* Overlay Tags - Positioned between content and scroll bar */}
              {content.trim() && paragraphBoundaries.length > 0 && (
                <>
                  {/* Highlight overlay for paragraph filtering */}
                  {filteredByTag && filteredByTag !== 'all' && (
                    <div className="absolute inset-0 pointer-events-none">
                      {paragraphBoundaries.map((boundary, i) => {
                        const next = paragraphBoundaries[i + 1];
                        const startY = boundary.actualTop;
                        const endY = next ? next.actualTop : textareaRef.current?.scrollHeight || 0;
                        const height = Math.max(0, endY - startY);
                        const tagForParagraph = tags.find(t => t.paragraphIndex === boundary.index);
                        const shouldDim = !tagForParagraph || tagForParagraph.tagType !== filteredByTag;
                        if (!shouldDim) return null; // Only dim non-matching paragraphs
                        return (
                          <div
                            key={`dim-${boundary.index}`}
                            className="absolute left-0 right-0 bg-gray-100 opacity-60"
                            style={{
                              top: `${startY}px`,
                              height: `${height}px`
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="absolute top-0 right-0 w-16 pointer-events-none"
                       style={{ height: `${Math.max(500, (content.split('\n').length + 5) * 24)}px` }}>
                    {paragraphBoundaries.map((boundary) => {
                      const tag = tags.find(t => t.paragraphIndex === boundary.index);
                      const isFiltered = filteredByTag && filteredByTag !== 'all';
                      const filteredTags = getFilteredTags();
                      const shouldShow = !isFiltered || (tag && filteredTags.includes(tag));
                      
                      if (!shouldShow && isFiltered) return null;
                      
                      return (
                        <div
                          key={boundary.index}
                          className="absolute right-4 pointer-events-auto transition-all duration-200"
                          style={{
                            top: `${boundary.actualTop}px`
                          }}
                        >
                          <ParagraphTagger
                            documentId={documentId}
                            userId={userId}
                            content={boundary.text}
                            fullDocumentContent={content}
                            paragraphIndex={boundary.index}
                            onTagUpdate={onTagsChange}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              
              {/* Help text for empty state */}
              {!content.trim() && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 text-center text-gray-500 pointer-events-none">
                  <p>📝 Start writing to see paragraph tags appear on the right</p>
                </div>
              )}
              
              {/* Analysis hint */}
              {content.trim() && !hasAISuggestions && (
                <div className="absolute bottom-4 left-4 right-20 p-3 bg-blue-50 border border-blue-200 rounded-lg pointer-events-none">
                  <p className="text-sm text-blue-800">
                    💡 Click "Analyze Text" to get AI suggestions and enable all paragraph tagging features.
                  </p>
                </div>
              )}
            </div>
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