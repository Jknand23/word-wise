import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSuggestionStore } from '../../stores/suggestionStore';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';
import { modificationTrackingService } from '../../services/modificationTrackingService';
import { useWritingGoalsStore } from '../../store/writingGoalsStore';
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
  const [, setScrollTop] = useState(0);
  const [paragraphBoundaries, setParagraphBoundaries] = useState<Array<{
    index: number;
    startPos: number;
    endPos: number;
    text: string;
  }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedContentRef = useRef<string>(initialContent || '');
  // Get actual pixel position of a character in the textarea
  const getCharacterPosition = React.useCallback((charIndex: number): number => {
    if (!textareaRef.current) {
      const textUpToChar = content.substring(0, charIndex);
      const linesBefore = (textUpToChar.match(/\n/g) || []).length;
      const computedLineHeight = parseFloat(window.getComputedStyle(textareaRef.current!).lineHeight || '24');
      const computedPadding = parseFloat(window.getComputedStyle(textareaRef.current!).paddingTop || '16');
      return linesBefore * computedLineHeight + computedPadding;
    }
    const textarea = textareaRef.current;
    try {
      const measureDiv = document.createElement('div');
      const cs = window.getComputedStyle(textarea);
      measureDiv.style.position = 'absolute';
      measureDiv.style.visibility = 'hidden';
      measureDiv.style.whiteSpace = 'pre-wrap';
      measureDiv.style.wordWrap = 'break-word';
      measureDiv.style.font = cs.font;
      measureDiv.style.lineHeight = cs.lineHeight;
      measureDiv.style.letterSpacing = cs.letterSpacing;
      measureDiv.style.boxSizing = 'border-box';
      measureDiv.style.width = `${textarea.clientWidth}px`;
      measureDiv.style.padding = cs.padding;
      measureDiv.style.border = 'none';
      measureDiv.style.maxWidth = `${textarea.clientWidth}px`;
      measureDiv.style.fontFamily = cs.fontFamily;
      const textUpToChar = content.substring(0, charIndex);
      measureDiv.textContent = textUpToChar;
      document.body.appendChild(measureDiv);
      const height = measureDiv.offsetHeight;
      document.body.removeChild(measureDiv);
      const paddingTop = parseFloat(cs.paddingTop || '0');
      return Math.max(0, height - paddingTop);
    } catch (error) {
      console.error('Error calculating character position:', error);
      const textUpToChar = content.substring(0, charIndex);
      const linesBefore = (textUpToChar.match(/\n/g) || []).length;
      const computedLineHeight = parseFloat(window.getComputedStyle(textareaRef.current!).lineHeight || '24');
      const computedPadding = parseFloat(window.getComputedStyle(textareaRef.current!).paddingTop || '16');
      return linesBefore * computedLineHeight + computedPadding;
    }
  }, [content]);
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
    // setFilter,
    // clearAllTags
  } = useParagraphTagStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const { goals, getGrammarStrictness, getVocabularyLevel, getToneRecommendation } = useWritingGoalsStore();

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
  }, [selectedSection, content, getCharacterPosition]);

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
      // Build context window based on paragraph-level diffs
      let contextWindow: Array<{ index: number; text: string; isChanged?: boolean }> | undefined = undefined;
      try {
        const prev = lastAnalyzedContentRef.current || '';
        const changes = await modificationTrackingService.trackParagraphChanges(
          documentId,
          userId,
          prev,
          content
        );
        const changed = changes.filter(c => c.type === 'added' || c.type === 'modified');
        if (changed.length > 0) {
          contextWindow = changed.map(c => ({ index: c.index, text: c.newText, isChanged: true }));
        }
      } catch (diffError) {
        console.warn('Diffing failed, continuing without contextWindow', diffError);
      }

      const writingGoals = {
        academicLevel: goals.academicLevel,
        assignmentType: goals.assignmentType,
        customInstructions: goals.customInstructions || '',
        grammarStrictness: getGrammarStrictness(),
        vocabularyLevel: getVocabularyLevel(),
        toneRecommendation: getToneRecommendation()
      };

      await requestAnalysis({
        content,
        documentId,
        userId,
        analysisType: 'incremental',
        contextWindow,
        writingGoals,
        timestamp: Date.now()
      });
      console.log('Auto-analysis completed');
      lastAnalyzedContentRef.current = content;
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
  const handleAnalyzeClick = async () => {
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
      const writingGoals = {
        academicLevel: goals.academicLevel,
        assignmentType: goals.assignmentType,
        customInstructions: goals.customInstructions || '',
        grammarStrictness: getGrammarStrictness(),
        vocabularyLevel: getVocabularyLevel(),
        toneRecommendation: getToneRecommendation()
      };

      await requestAnalysis({
        content,
        documentId,
        userId,
        analysisType: 'full',
        bypassCache: true,
        writingGoals,
        timestamp: Date.now()
      });
      console.log('Manual analysis completed successfully');
      lastAnalyzedContentRef.current = content;
      
      // 🔍 DEBUG: Wait a moment and check what's in Firestore
      setTimeout(async () => {
        console.log('🔍 [DEBUG] Auto-checking Firestore 3 seconds after analysis...');
        try {


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
              const data = doc.data() as Record<string, unknown>;
              return {
                id: doc.id, 
                status: data.status as string,
                originalText: data.originalText as string,
                type: data.type as string,
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
                const data = doc.data() as Record<string, unknown>;
                return {
                  id: doc.id, 
                  status: data.status as string,
                  originalText: data.originalText as string,
                  type: data.type as string,
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



  // const handleParagraphClick = (event: React.MouseEvent<HTMLDivElement>) => {
  //   const target = event.target as HTMLElement;
  //   if (target.tagName === 'SPAN' && target.dataset.suggestionId) {
  //     const suggestionId = target.dataset.suggestionId;
  //     const clickedSuggestion = suggestions.find(s => s.id === suggestionId);
  //     if (clickedSuggestion) {
  //       setTooltipSuggestion(clickedSuggestion);
  //       const rect = target.getBoundingClientRect();
  //       const x = rect.left - 345;
  //       const y = rect.top;
  //       setTooltipPosition({ x, y });
  //       setTooltipVisible(true);
  //       event.preventDefault();
  //       return;
  //     }
  //   }
  //   if (tooltipVisible) {
  //     setTooltipVisible(false);
  //     setTooltipSuggestion(null);
  //   }
  // };

  // const renderParagraphWithHighlights = (paragraphText: string, paragraphStartIndex: number) => {
  //   if (!highlightsVisible || suggestions.length === 0) {
  //     return escapeHtml(paragraphText);
  //   }
  //   const paragraphEndIndex = paragraphStartIndex + paragraphText.length;
  //   const relevantSuggestions = suggestions.filter(suggestion => {
  //     const overlaps = suggestion.startIndex < paragraphEndIndex && suggestion.endIndex > paragraphStartIndex;
  //     const existsInParagraph = paragraphText.includes(suggestion.originalText);
  //     return overlaps || existsInParagraph;
  //   });
  //   const validSuggestions = relevantSuggestions.map(suggestion => {
  //     const textAtPosition = content.slice(suggestion.startIndex, suggestion.endIndex);
  //     if (textAtPosition === suggestion.originalText) return suggestion;
  //     const globalIndex = content.indexOf(suggestion.originalText);
  //     if (globalIndex !== -1) return { ...suggestion, startIndex: globalIndex, endIndex: globalIndex + suggestion.originalText.length };
  //     const paragraphIndex = paragraphText.indexOf(suggestion.originalText);
  //     if (paragraphIndex !== -1) return { ...suggestion, startIndex: paragraphStartIndex + paragraphIndex, endIndex: paragraphStartIndex + paragraphIndex + suggestion.originalText.length };
  //     return null;
  //   }).filter(s => s !== null) as Suggestion[];
  //   const paragraphSuggestions = validSuggestions.filter(suggestion => suggestion.startIndex >= paragraphStartIndex && suggestion.endIndex <= paragraphEndIndex);
  //   if (paragraphSuggestions.length === 0) return escapeHtml(paragraphText);
  //   const sortedSuggestions = paragraphSuggestions.sort((a, b) => a.startIndex - b.startIndex);
  //   let highlightedContent = '';
  //   let lastIndex = paragraphStartIndex;
  //   sortedSuggestions.forEach((suggestion) => {
  //     const beforeText = content.slice(lastIndex, suggestion.startIndex);
  //     highlightedContent += escapeHtml(beforeText);
  //     const suggestionText = content.slice(suggestion.startIndex, suggestion.endIndex);
  //     const isSelected = selectedSuggestion?.id === suggestion.id;
  //     const colorClass = isSelected ? getSuggestionSelectedHighlightColor(suggestion.type) : getSuggestionHighlightColor(suggestion.type);
  //     highlightedContent += `<span class="${colorClass}" data-suggestion-id="${suggestion.id}">${escapeHtml(suggestionText)}</span>`;
  //     lastIndex = suggestion.endIndex;
  //   });
  //   const remainingText = content.slice(lastIndex, paragraphEndIndex);
  //   highlightedContent += escapeHtml(remainingText);
  //   return highlightedContent;
  // };

  // const handleParagraphEdit = (paragraphIndex: number, newText: string) => {
  //   const paragraphs = paragraphTagService.extractParagraphs(content);
  //   let newContent = '';
  //   paragraphs.forEach((p, idx) => {
  //     if (idx === paragraphIndex) {
  //       newContent += newText;
  //     } else {
  //       newContent += p.text;
  //     }
  //     if (idx < paragraphs.length - 1) {
  //       newContent += '\n\n';
  //     }
  //   });
  //   handleContentChange(newContent);
  // };

  // Note: Filter UI helpers removed as they were unused

  // Calculate paragraph boundaries for tag positioning (without layout positions)
  const calculateParagraphBoundaries = (text: string) => {
    if (!text.trim()) return [];
    
    const boundaries: Array<{
      index: number;
      startPos: number;
      endPos: number;
      text: string;
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
        
        boundaries.push({
          index: paragraphIndex,
          startPos,
          endPos,
          text: trimmedSection
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

  // moved earlier definition; remove duplicate

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
            top: Math.max(0, getCharacterPosition(matchingBoundary.startPos) - 40),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [filteredByTag, paragraphBoundaries, tags, getCharacterPosition]);

  // Build inline highlight segments to mirror textarea content accurately
  const highlightSegments = React.useMemo(() => {
    if (!highlightsVisible || suggestions.length === 0 || !content) {
      return [{ text: content, highlight: null as null | Suggestion }];
    }
    // Helpers to ensure word-boundary matching for spelling suggestions
    const isLetter = (ch: string) => /[A-Za-z]/.test(ch);
    const isWordBoundary = (text: string, start: number, end: number) => {
      const prev = start - 1 >= 0 ? text[start - 1] : '';
      const next = end < text.length ? text[end] : '';
      const leftBoundary = start === 0 || !isLetter(prev);
      const rightBoundary = end === text.length || !isLetter(next);
      return leftBoundary && rightBoundary;
    };
    const findBoundedIndex = (text: string, phrase: string, from: number = 0) => {
      if (!phrase) return -1;
      let idx = text.indexOf(phrase, from);
      while (idx !== -1) {
        const end = idx + phrase.length;
        if (isWordBoundary(text, idx, end)) return idx;
        idx = text.indexOf(phrase, idx + 1);
      }
      return -1;
    };

    // Step 1: validate and re-index suggestions against current content
    const valid: Suggestion[] = [];
    suggestions.forEach((s) => {
      const direct = content.slice(s.startIndex, s.endIndex);
      if (direct === s.originalText) {
        if (s.type === 'spelling') {
          // Ensure whole-word match for spelling suggestions
          if (isWordBoundary(content, s.startIndex, s.endIndex)) {
            valid.push(s);
          } else {
            // Try to re-locate a bounded occurrence
            const idx = findBoundedIndex(content, s.originalText);
            if (idx !== -1) valid.push({ ...s, startIndex: idx, endIndex: idx + s.originalText.length });
          }
        } else {
          valid.push(s);
        }
        return;
      }
      // Fallback: locate by text content; for spelling, require word boundaries
      if (s.originalText && s.originalText.length > 0) {
        if (s.type === 'spelling') {
          const idx = findBoundedIndex(content, s.originalText);
          if (idx !== -1) valid.push({ ...s, startIndex: idx, endIndex: idx + s.originalText.length });
        } else {
          const idx = content.indexOf(s.originalText);
          if (idx !== -1) valid.push({ ...s, startIndex: idx, endIndex: idx + s.originalText.length });
        }
      }
    });
    // Step 2: sort and merge/clip overlapping ranges to prevent duplicate text rendering
    const sorted = valid
      .filter((s) => s.startIndex < s.endIndex)
      .map((s) => ({
        ...s,
        startIndex: Math.max(0, Math.min(s.startIndex, content.length)),
        endIndex: Math.max(0, Math.min(s.endIndex, content.length))
      }))
      .sort((a, b) => (a.startIndex !== b.startIndex ? a.startIndex - b.startIndex : a.endIndex - b.endIndex));

    const nonOverlap: Suggestion[] = [];
    let lastEnd = -1;
    for (const s of sorted) {
      let start = s.startIndex;
      let end = s.endIndex;
      if (end <= lastEnd) {
        // Fully covered by previous; skip
        continue;
      }
      if (start < lastEnd) {
        // Clip to avoid overlap
        start = lastEnd;
      }
      if (start >= end) continue;
      nonOverlap.push({ ...s, startIndex: start, endIndex: end });
      lastEnd = end;
    }
    const segments: Array<{ text: string; highlight: null | Suggestion }> = [];
    let cursor = 0;
    for (const s of nonOverlap) {
      if (s.startIndex > cursor) {
        segments.push({ text: content.slice(cursor, s.startIndex), highlight: null });
      }
      const segText = content.slice(s.startIndex, s.endIndex);
      segments.push({ text: segText, highlight: s });
      cursor = s.endIndex;
    }
    if (cursor < content.length) {
      segments.push({ text: content.slice(cursor), highlight: null });
    }
    return segments;
  }, [content, suggestions, highlightsVisible]);

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
              {/* Mirror overlay rendering full text with inline highlights */}
              {textareaRef.current && (
                <div
                  className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words font-sans"
                  style={{
                    padding: window.getComputedStyle(textareaRef.current).padding,
                    // Hide overlay glyphs so only background colors show; base textarea text remains visible
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: window.getComputedStyle(textareaRef.current).lineHeight,
                    letterSpacing: window.getComputedStyle(textareaRef.current).letterSpacing,
                    fontFamily: window.getComputedStyle(textareaRef.current).fontFamily,
                    fontSize: window.getComputedStyle(textareaRef.current).fontSize,
                    whiteSpace: 'pre-wrap',
                    zIndex: 0,
                  }}
                >
                  {highlightSegments.map((seg, i) => {
                    if (!seg.highlight) {
                      return <span key={`seg-${i}`}>{seg.text}</span>;
                    }
                    const type = seg.highlight.type;
                    const cls = type === 'spelling'
                      ? 'bg-red-100'
                      : type === 'grammar'
                        ? 'bg-orange-100'
                        : type === 'clarity'
                          ? 'bg-yellow-100'
                          : type === 'engagement'
                            ? 'bg-blue-100'
                            : 'bg-green-100';
                    return (
                      <span key={`seg-${i}`} className={`${cls} rounded-sm`}>{seg.text}</span>
                    );
                  })}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onClick={handleTextareaClick}
                placeholder="Start writing your document here..."
                spellCheck={true}
                className="w-full p-4 pr-20 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 leading-relaxed overflow-hidden font-sans"
                style={{ 
                  minHeight: '500px',
                  height: 'auto',
                  lineHeight: '1.5',
                  backgroundColor: 'transparent',
                  position: 'relative',
                  zIndex: 1
                }}
                rows={Math.max(20, content.split('\n').length + 5)}
              />
              
              {/* Overlay Tags - Positioned between content and scroll bar */}
              {content.trim() && paragraphBoundaries.length > 0 && (
                <>
                  {/* Highlight overlay for paragraph filtering */}
                  {filteredByTag && filteredByTag !== 'all' && textareaRef.current && (
                    <div className="absolute inset-0 pointer-events-none">
                      {paragraphBoundaries.map((boundary) => {
                        const startY = getCharacterPosition(boundary.startPos);
                        const endY = getCharacterPosition(boundary.endPos);
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
                            top: `${getCharacterPosition(boundary.startPos)}px`
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