import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Share2, AlertCircle, FileText } from 'lucide-react';
import TextEditor from '../components/ai/TextEditor';
import SuggestionsPanel from '../components/ai/SuggestionsPanel';
import StructureSidebar from '../components/ai/StructureSidebar';
import RubricManager from '../components/ai/RubricManager';
import RubricFeedbackPanel from '../components/ai/RubricFeedbackPanel';
import ParagraphTaggingControls from '../components/ai/ParagraphTaggingControls';
import { useAuthStore } from '../store/authStore';
import { useSuggestionStore } from '../stores/suggestionStore';
import { useWritingGoalsStore } from '../store/writingGoalsStore';
import { documentService } from '../services/documentService';
import { progressService } from '../services/progressService';
import type { Suggestion, EssaySection, AssignmentRubric, RubricFeedback } from '../types/suggestion';

const DocumentEditor: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const { setActiveDocument, clearSuggestions, error: suggestionError, setError, suggestions, rejectSuggestion, acceptSuggestion, requestAnalysis } = useSuggestionStore();
  const { goals } = useWritingGoalsStore();
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [documentContent, setDocumentContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [highlightsVisible, setHighlightsVisible] = useState<boolean>(true);

  const [selectedSection, setSelectedSection] = useState<EssaySection | null>(null);
  
  // Rubric-related state
  const [showRubricManager, setShowRubricManager] = useState(false);
  const [selectedRubric, setSelectedRubric] = useState<AssignmentRubric | null>(null);
  const [rubricFeedback, setRubricFeedback] = useState<RubricFeedback | null>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<'suggestions' | 'rubric'>('suggestions');
  
  // Track the current document ID - this will be updated when a new document is created
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

  // Auto-save timeout ref to prevent multiple auto-saves
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if we just created a new document to prevent unnecessary reloads
  const justCreatedRef = useRef<boolean>(false);
  
  // Track if there are unsaved changes
  const hasUnsavedChangesRef = useRef<boolean>(false);

  // 🔍 DEBUG: Log component state on every render
  console.log('🏠 [DocumentEditor] Component render:', {
    documentId,
    isAuthLoading,
    'user?.uid': user?.uid,
    'suggestions.length': suggestions.length,
    currentDocumentId,
    timestamp: new Date().toISOString()
  });

  // 🔍 DEBUG: Check subscription state from store
  const { activeDocumentId, unsubscribe: hasUnsubscribe } = useSuggestionStore();
  console.log('🔍 [DocumentEditor] Subscription state check:', {
    activeDocumentIdFromStore: activeDocumentId,
    hasUnsubscribeFunction: !!hasUnsubscribe,
    shouldHaveSubscription: !!(user?.uid && (currentDocumentId || documentId))
  });

  // 🔍 DEBUG: Force subscription if missing
  React.useEffect(() => {
    const docIdToUse = currentDocumentId || (documentId !== 'new' ? documentId : null);
    const shouldHaveSubscription = !!(user?.uid && docIdToUse);
    const hasSubscription = !!(hasUnsubscribe && activeDocumentId === docIdToUse);
    
    console.log('🔍 [DocumentEditor] FORCE CHECK useEffect:', {
      shouldHaveSubscription,
      hasSubscription,
      activeDocumentId,
      docIdToUse,
      'user?.uid': user?.uid
    });
    
    if (shouldHaveSubscription && !hasSubscription) {
      console.log('🔍 [DocumentEditor] FORCE SETTING UP MISSING SUBSCRIPTION:', {
        docIdToUse,
        userId: user?.uid
      });
      setActiveDocument(docIdToUse, user.uid);
    }
  }); // Run on every render to catch missing subscriptions

  // Component render tracking removed for cleaner console
  
  // Subscribe to document suggestions when the component mounts
  useEffect(() => {
    console.log('🔍 [DocumentEditor] Subscription useEffect TRIGGERED!');
    console.log('🔍 [DocumentEditor] Subscription setup check:', {
      'user?.uid': user?.uid,
      currentDocumentId,
      documentId,
      'hasUser': !!user?.uid,
      'hasCurrentDocumentId': !!currentDocumentId,
      'shouldSetupSubscription': !!(user?.uid && currentDocumentId)
    });
    
    // Use currentDocumentId if available, otherwise fall back to documentId from URL
    const docIdToUse = currentDocumentId || (documentId !== 'new' ? documentId : null);
    
    console.log('🔍 [DocumentEditor] docIdToUse calculated:', { docIdToUse, documentId, currentDocumentId });
    
    if (user?.uid && docIdToUse) {
      console.log('🔍 [DocumentEditor] ✅ SETTING UP SUBSCRIPTION for:', { 
        docIdToUse, 
        userId: user.uid,
        source: currentDocumentId ? 'currentDocumentId' : 'documentId' 
      });
      setActiveDocument(docIdToUse, user.uid);
    } else {
      console.log('🔍 [DocumentEditor] ❌ SKIPPING subscription setup - missing requirements:', {
        hasUser: !!user?.uid,
        hasDocId: !!docIdToUse,
        documentId,
        currentDocumentId,
        userUid: user?.uid
      });
    }
    
    // Cleanup subscription on unmount
    return () => {
      console.log('🔍 [DocumentEditor] Cleaning up subscription');
      clearSuggestions();
    };
  }, [currentDocumentId, documentId, user?.uid, setActiveDocument]);

  // Track quality metrics when new suggestions arrive
  useEffect(() => {
    if (user?.uid && currentDocumentId && suggestions.length > 0 && documentContent.trim()) {
      const document = {
        id: currentDocumentId,
        wordCount: documentContent.trim().split(/\s+/).length,
        createdAt: new Date(),
        userId: user.uid,
        title: documentTitle,
        content: documentContent,
        updatedAt: new Date()
      };

      const qualityMetrics = progressService.calculateQualityMetrics(document, suggestions);
      
      // Store quality metrics for progress tracking
      progressService.storeQualityMetrics(user.uid, currentDocumentId, {
        errorRate: qualityMetrics.errorRate,
        suggestionDensity: qualityMetrics.suggestionDensity,
        wordCount: qualityMetrics.wordCount
      }).catch(error => {
        console.error('Failed to store quality metrics:', error);
      });
    }
  }, [suggestions, user?.uid, currentDocumentId, documentContent, documentTitle]);

  // ✅ ADD: Handle page unload to ensure auto-save completes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        // Clear any pending timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        // Show warning to user about unsaved changes
        try {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return 'You have unsaved changes. Are you sure you want to leave?';
        } catch (error) {
          console.error('Failed to show warning on beforeunload:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && hasUnsavedChangesRef.current) {
        // Clear the timeout and save immediately
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        // Force immediate save when tab becomes hidden
        handleSave().then(() => {
          hasUnsavedChangesRef.current = false;
        }).catch(error => {
          console.error('Failed to save on visibility change:', error);
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Prevent loading if already loading
    if (isLoading) {
      return;
    }

    if (documentId === 'new') {
      // Setup new document - reset all state
      setDocumentTitle('New Document');
      setDocumentContent('');
      setCurrentDocumentId(null);
      setLastSaved(null);
      justCreatedRef.current = false;
    } else if (documentId && user?.uid) {
      // Don't reload if we just created this document
      if (justCreatedRef.current && currentDocumentId === documentId) {
        justCreatedRef.current = false;
        return;
      }
      
      // Only load document data if we don't already have the current document ID
      // This prevents reloading when we navigate after creating a new document
      if (currentDocumentId !== documentId) {
        loadDocumentData(documentId);
      }
    }
  }, [documentId, user?.uid, isLoading]);

  const loadDocumentData = async (docId: string) => {
    if (!user?.uid) return;
    
    // Clear existing content first to prevent duplication
    setDocumentTitle('');
    setDocumentContent('');
    setLastSaved(null);
    
    // Set loading state to prevent overlapping loads
    setIsLoading(true);
    
    try {
      const document = await documentService.getDocument(docId, user.uid);
      if (document) {
        setDocumentTitle(document.title);
        setDocumentContent(document.content);
        setLastSaved(document.updatedAt);
        setCurrentDocumentId(docId);
      } else {
        setDocumentTitle('Document Not Found');
        setDocumentContent('The requested document could not be found.');
        setCurrentDocumentId(docId); // Set ID even for not found to prevent repeated attempts
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      setDocumentTitle('Error Loading Document');
      setDocumentContent('Failed to load document. Please try again.');
      setCurrentDocumentId(docId); // Set ID even for errors to prevent repeated attempts
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (overrideContent?: string, overrideTitle?: string) => {
    if (!user?.uid) return;
    
    // Prevent multiple simultaneous saves
    if (isSaving) {
      return;
    }
    
    setIsSaving(true);
    try {
      // Use provided content/title or current state
      const contentToSave = overrideContent !== undefined ? overrideContent : documentContent;
      const titleToSave = overrideTitle !== undefined ? overrideTitle : documentTitle;

      if (documentId === 'new' && !currentDocumentId) {
        // Create new document
        const newDocumentId = await documentService.createDocument(
          user.uid,
          titleToSave,
          contentToSave
        );
        
        // Update the current document ID state
        setCurrentDocumentId(newDocumentId);
        
        // Mark that we just created this document
        justCreatedRef.current = true;
        
        // Update URL to reflect the new document ID
        navigate(`/document/${newDocumentId}`, { replace: true });
      } else {
        // Update existing document
        const docIdToUpdate = currentDocumentId || documentId;
        
        if (docIdToUpdate && docIdToUpdate !== 'new') {
          await documentService.updateDocument(
            docIdToUpdate,
            user.uid,
            {
              title: titleToSave,
              content: contentToSave
            }
          );
        }
      }
      setLastSaved(new Date());
      // Clear unsaved changes flag after successful save
      hasUnsavedChangesRef.current = false;
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: string, isFromSuggestion: boolean = false) => {
    setDocumentContent(newContent);
    
    // Track that we have unsaved changes
    hasUnsavedChangesRef.current = true;
    
    // Validate and clean suggestions whenever content changes
    if (suggestions.length > 0) {
      // If content is empty or very short, clear all suggestions immediately
      if (newContent.trim().length < 3) {
        suggestions.forEach(suggestion => {
          rejectSuggestion(suggestion.id).catch(error => {
            console.error('Failed to clear suggestion:', error);
          });
        });
      } else {
        // Otherwise validate each suggestion
        setTimeout(() => {
          validateAndCleanSuggestions(newContent);
        }, 100); // Small delay to let state update
      }
    }
    
    // Clear any existing auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Much faster auto-save for suggestion acceptance
    const saveDelay = isFromSuggestion ? 200 : 2000; // 200ms for suggestions, 2s for typing
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      await handleSave(newContent, documentTitle);
      // Clear unsaved changes flag after successful save
      hasUnsavedChangesRef.current = false;
    }, saveDelay);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentTitle(e.target.value);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleSuggestionSelect = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    
    // Force a re-render to update highlights
    setTimeout(() => {
      // This small delay ensures the selection state has been processed
      setDocumentContent(currentContent => currentContent);
    }, 10);
  };

  const validateAndCleanSuggestions = async (currentContent: string) => {
    const invalidSuggestions = [];
    
    for (const suggestion of suggestions) {
      const textAtIndices = currentContent.slice(suggestion.startIndex, suggestion.endIndex);
      
      if (textAtIndices !== suggestion.originalText) {
        // Check if the original text exists anywhere in the document
        const actualIndex = currentContent.indexOf(suggestion.originalText);
        
        if (actualIndex === -1) {
          // Original text no longer exists, mark for removal
          invalidSuggestions.push(suggestion.id);
        }
      }
    }
    
    // Remove invalid suggestions
    for (const suggestionId of invalidSuggestions) {
      try {
        await rejectSuggestion(suggestionId);
      } catch (error) {
        console.error('Failed to remove invalid suggestion:', error);
      }
    }
  };

  const handleSuggestionAccept = async (suggestion: Suggestion) => {
    try {
      console.log('🔧 DocumentEditor: Starting suggestion acceptance', {
        suggestionId: suggestion.id,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        startIndex: suggestion.startIndex,
        endIndex: suggestion.endIndex,
        currentContentLength: documentContent.length
      });

      // Verify the suggestion is still valid against current content
      const actualTextAtIndices = documentContent.slice(suggestion.startIndex, suggestion.endIndex);
      let validStartIndex = suggestion.startIndex;
      let validEndIndex = suggestion.endIndex;
      
      if (actualTextAtIndices !== suggestion.originalText) {
        console.warn('DocumentEditor: Suggestion indices are stale, searching for correct position');
        console.log('Expected:', suggestion.originalText);
        console.log('Found at original indices:', actualTextAtIndices);
        
        // Try to find the correct position of the original text
        const actualIndex = documentContent.indexOf(suggestion.originalText);
        if (actualIndex === -1) {
          console.error('DocumentEditor: Original text not found, rejecting stale suggestion');
          // Remove this stale suggestion from the store
          await rejectSuggestion(suggestion.id);
          return;
        }
        
        // Update to the correct indices
        validStartIndex = actualIndex;
        validEndIndex = actualIndex + suggestion.originalText.length;
        
        console.log('DocumentEditor: Found correct position', {
          oldStart: suggestion.startIndex,
          oldEnd: suggestion.endIndex,
          newStart: validStartIndex,
          newEnd: validEndIndex
        });
      }

      // Final validation - ensure the text at valid indices matches expectation
      const finalTextAtIndices = documentContent.slice(validStartIndex, validEndIndex);
      if (finalTextAtIndices !== suggestion.originalText) {
        console.error('DocumentEditor: Final validation failed', {
          expected: suggestion.originalText,
          found: finalTextAtIndices,
          validStartIndex,
          validEndIndex
        });
        await rejectSuggestion(suggestion.id);
        return;
      }

      // Apply the suggestion using clean text replacement
      const beforeText = documentContent.slice(0, validStartIndex);
      const afterText = documentContent.slice(validEndIndex);
      const newContent = beforeText + suggestion.suggestedText + afterText;

      // Validate the replacement
      const expectedLengthChange = suggestion.suggestedText.length - suggestion.originalText.length;
      const actualLengthChange = newContent.length - documentContent.length;
      
      if (actualLengthChange !== expectedLengthChange) {
        console.error('DocumentEditor: Length change mismatch - aborting to prevent duplication', {
          expectedChange: expectedLengthChange,
          actualChange: actualLengthChange,
          suggestion
        });
        return;
      }

      console.log('✅ DocumentEditor: Applying clean text replacement:', {
        original: suggestion.originalText,
        suggested: suggestion.suggestedText,
        beforeText: beforeText.slice(-20),
        afterText: afterText.slice(0, 20),
        lengthChange: actualLengthChange
      });
      
      // Use handleContentChange with fast auto-save for suggestions
      // This ensures the auto-save mechanism works correctly with shorter delay
      handleContentChange(newContent, true); // true = isFromSuggestion
      setSelectedSuggestion(null);
      
      // Accept the suggestion in the store
      await acceptSuggestion(suggestion.id);
      
      // Clear stale suggestions but be more conservative
      const staleSuggestions = suggestions.filter(s => {
        if (s.id === suggestion.id) return false; // Skip the accepted one
        
        // Check if this suggestion's text still exists
        const suggestionText = documentContent.slice(s.startIndex, s.endIndex);
        return suggestionText !== s.originalText && documentContent.indexOf(s.originalText) === -1;
      });
      
      console.log(`DocumentEditor: Clearing ${staleSuggestions.length} stale suggestions`);
      staleSuggestions.forEach(s => {
        rejectSuggestion(s.id).catch(error => {
          console.error('Failed to clear stale suggestion:', error);
        });
      });
      
    } catch (error) {
      console.error('DocumentEditor: Failed to apply suggestion:', error);
    }
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleToggleHighlights = (visible: boolean) => {
    setHighlightsVisible(visible);
  };

  const handleTagsChange = () => {
    // Force re-render when tags change
  };

  const handleSectionClick = (section: EssaySection) => {
    // Simply store the selected section and let TextEditor handle accurate highlighting & scrolling
    setSelectedSection(section);
  };

  const handleStructureAnalysisComplete = () => {
    // Refresh suggestions after structure analysis to include new structure suggestions
    if (user?.uid && currentDocumentId && documentContent.trim()) {
      requestAnalysis({
        content: documentContent,
        documentId: currentDocumentId,
        userId: user.uid,
        analysisType: 'incremental'
      }).catch(error => {
        console.error('Failed to refresh suggestions after structure analysis:', error);
      });
    }
  };

  // 🔍 DEBUG: Force subscription setup manually
  const debugForceSubscription = () => {
    const docIdToUse = currentDocumentId || (documentId !== 'new' ? documentId : null);
    console.log('🔍 [DEBUG] Manually forcing subscription setup...', {
      docIdToUse,
      'user?.uid': user?.uid,
      currentDocumentId,
      documentId
    });
    
    if (user?.uid && docIdToUse) {
      console.log('🔍 [DEBUG] Calling setActiveDocument manually...');
      setActiveDocument(docIdToUse, user.uid);
    } else {
      console.log('🔍 [DEBUG] Cannot force subscription - missing requirements');
    }
  };

  // 🔍 DEBUG: Manual function to check Firestore for suggestions
  const debugCheckFirestoreSuggestions = async () => {
    if (!user?.uid) return;
    
    const docIdToCheck = currentDocumentId || (documentId !== 'new' ? documentId : null);
    if (!docIdToCheck) return;

    console.log('🔍 [DEBUG] Manually checking Firestore for suggestions...', { 
      docIdToCheck, 
      userId: user.uid 
    });

    try {
      // Import Firebase functions here to avoid importing at module level
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const q = query(
        collection(db, 'suggestions'),
        where('documentId', '==', docIdToCheck),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      console.log('🔍 [DEBUG] Firestore query results:', {
        totalDocs: snapshot.docs.length,
        docs: snapshot.docs.map(doc => ({ 
          id: doc.id, 
          status: doc.data().status,
          originalText: doc.data().originalText,
          type: doc.data().type 
        }))
      });
    } catch (error) {
      console.error('🔍 [DEBUG] Error querying Firestore:', error);
    }
  };

  const handleRubricSelect = (rubric: AssignmentRubric) => {
    setSelectedRubric(rubric);
    setShowRubricManager(false);
    setActiveRightPanel('rubric');
  };

  const handleRubricAnalysisUpdate = (feedback: RubricFeedback) => {
    setRubricFeedback(feedback);
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-medium">Loading Editor...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-medium">Loading Document...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <div className="flex justify-center gap-6 w-full max-w-none">
              {/* Left section - aligned with Essay Structure panel */}
              <div className="w-80 flex items-center justify-start flex-shrink-0">
                <button
                  onClick={handleBackToDashboard}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </button>
              </div>

              {/* Center section - aligned with Document Editor panel */}
              <div className="w-[800px] flex items-center justify-center flex-shrink-0">
                <div className="flex flex-col items-center">
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={handleTitleChange}
                    className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 text-center max-w-md"
                    placeholder="Document title..."
                  />
                  {lastSaved && (
                    <span className="text-xs text-gray-500 mt-1">
                      Last saved: {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Right section - aligned with AI Suggestions panel */}
              <div className="w-80 flex items-center justify-end space-x-3 flex-shrink-0">
                <button
                  onClick={debugForceSubscription}
                  className="inline-flex items-center px-2 py-1 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none"
                  title="Debug: Force subscription setup"
                >
                  🔗 Sub
                </button>
                
                <button
                  onClick={debugCheckFirestoreSuggestions}
                  className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none"
                  title="Debug: Check Firestore for suggestions"
                >
                  🔍 Debug
                </button>
                
                <button
                  onClick={() => setShowRubricManager(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Rubrics
                </button>
                
                <button
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>

                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {suggestionError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 flex-shrink-0">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {suggestionError}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={handleDismissError}
                  className="inline-flex bg-yellow-50 rounded-md p-1.5 text-yellow-500 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Fixed height container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
          <div className="flex justify-center gap-6 h-full overflow-hidden mb-4">
            {/* Left sidebar - Essay Structure with expanded height */}
            <div className="hidden lg:flex w-80 flex-shrink-0">
              {goals.assignmentType === 'essay' && user?.uid && (
                <div className="bg-white rounded-lg shadow-sm border flex flex-col w-full" style={{ height: 'calc(100vh - 120px)' }}>
                  <StructureSidebar
                    documentId={currentDocumentId || documentId || ''}
                    userId={user.uid}
                    content={documentContent}
                    onSectionClick={handleSectionClick}
                    onRequestAnalysis={handleStructureAnalysisComplete}
                  />
                </div>
              )}
            </div>

            {/* Text Editor - Fixed width and expanded height container */}
            <div className="w-[800px] flex-shrink-0 flex flex-col overflow-hidden">
              <div className="bg-white rounded-lg shadow-sm border flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
                {/* Paragraph Tagging Controls */}
                <div className="flex-shrink-0">
                  <ParagraphTaggingControls documentId={currentDocumentId || documentId || ''} userId={user?.uid || ''} />
                </div>
                
                {/* Text Editor with scrolling */}
                <div className="flex-1 overflow-y-auto">
                  <TextEditor 
                    documentId={currentDocumentId || documentId || ''}
                    userId={user?.uid}
                    initialContent={documentContent}
                    onContentChange={handleContentChange}
                    selectedSuggestion={selectedSuggestion}
                    selectedSection={selectedSection}
                    highlightsVisible={highlightsVisible}
                    onTagsChange={handleTagsChange}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel - AI Suggestions with expanded height */}
            <div className="hidden lg:flex w-80 flex-shrink-0">
              {user?.uid && (
                <div className="bg-white rounded-lg shadow-sm border flex flex-col w-full" style={{ height: 'calc(100vh - 120px)' }}>
                  {/* Panel Toggle */}
                  <div className="flex border-b flex-shrink-0">
                    <button
                      onClick={() => setActiveRightPanel('suggestions')}
                      className={`flex-1 px-4 py-2 text-sm font-medium ${
                        activeRightPanel === 'suggestions'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Suggestions
                    </button>
                    <button
                      onClick={() => setActiveRightPanel('rubric')}
                      className={`flex-1 px-4 py-2 text-sm font-medium ${
                        activeRightPanel === 'rubric'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Rubric
                    </button>
                  </div>

                  {/* Panel Content with scrolling */}
                  <div className="flex-1 overflow-hidden">
                    {activeRightPanel === 'suggestions' && (
                      <SuggestionsPanel
                        documentId={currentDocumentId || documentId || ''}
                        userId={user.uid}
                        content={documentContent}
                        onSuggestionSelect={handleSuggestionSelect}
                        onSuggestionAccept={handleSuggestionAccept}
                        onToggleHighlights={handleToggleHighlights}
                      />
                    )}

                    {activeRightPanel === 'rubric' && (
                      <>
                        {selectedRubric ? (
                          <RubricFeedbackPanel
                            documentId={currentDocumentId || documentId || ''}
                            content={documentContent}
                            selectedRubric={selectedRubric}
                          />
                        ) : (
                          <div className="p-6 text-center text-gray-500 h-full flex flex-col justify-center">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium mb-2">No rubric selected</p>
                            <p className="text-sm mb-4">Add a rubric to get assignment-specific feedback</p>
                            <button
                              onClick={() => setShowRubricManager(true)}
                              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Manage Rubrics
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rubric Manager Modal */}
      {showRubricManager && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div 
                className="absolute inset-0 bg-gray-500 opacity-75"
                onClick={() => setShowRubricManager(false)}
              ></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full max-h-[90vh] overflow-y-auto">
              <RubricManager
                documentId={currentDocumentId || documentId || ''}
                userId={user?.uid || ''}
                onRubricSelect={handleRubricSelect}
                onClose={() => setShowRubricManager(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor; 