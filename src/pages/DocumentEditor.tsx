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
  const { setActiveDocument, clearSuggestions, error: suggestionError, setError, suggestions, rejectSuggestion, requestAnalysis } = useSuggestionStore();
  const { goals } = useWritingGoalsStore();
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [documentContent, setDocumentContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  console.log('DocumentEditor component render:', {
    documentId,
    currentDocumentId,
    userEmail: user?.email,
    isAuthLoading
  });
  
  // Subscribe to document suggestions when the component mounts
  useEffect(() => {
    if (user?.uid && currentDocumentId) {
      setActiveDocument(currentDocumentId, user.uid);
    }
    
    // Cleanup subscription on unmount
    return () => {
      clearSuggestions();
    };
  }, [currentDocumentId, user?.uid, setActiveDocument]);

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

  useEffect(() => {
    console.log('DocumentEditor useEffect triggered:', {
      documentId,
      currentDocumentId,
      userUid: user?.uid,
      justCreated: justCreatedRef.current
    });



    if (documentId === 'new') {
      console.log('Setting up new document - resetting title to "New Document"');
      setDocumentTitle('New Document');
      setDocumentContent('');
      setCurrentDocumentId(null); // Reset for new document
      justCreatedRef.current = false;
    } else if (documentId && user?.uid) {
      // Don't reload if we just created this document
      if (justCreatedRef.current && currentDocumentId === documentId) {
        console.log('Skipping load for just-created document:', documentId);
        justCreatedRef.current = false;
        return;
      }
      
      // Only load document data if we don't already have the current document ID
      // This prevents reloading when we navigate after creating a new document
      if (currentDocumentId !== documentId) {
        console.log('Loading document data for:', documentId, 'current was:', currentDocumentId);
        loadDocumentData(documentId);
      } else {
        console.log('Document already loaded, skipping load for:', documentId);
      }
    } else {
      console.log('Not loading document - missing conditions:', { 
        hasDocumentId: !!documentId, 
        hasUser: !!user?.uid 
      });
    }
  }, [documentId, user?.uid]); // Removed currentDocumentId from dependencies to prevent loops

  const loadDocumentData = async (docId: string) => {
    if (!user?.uid) return;
    
    try {
      console.log('Loading document data for ID:', docId);
      const document = await documentService.getDocument(docId, user.uid);
      if (document) {
        console.log('Loaded document:', { title: document.title, contentLength: document.content.length });
        setDocumentTitle(document.title);
        setDocumentContent(document.content);
        setLastSaved(document.updatedAt);
        setCurrentDocumentId(docId); // Set current document ID after successful load
      } else {
        console.log('Document not found:', docId);
        setDocumentTitle('Document Not Found');
        setDocumentContent('The requested document could not be found.');
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      setDocumentTitle('Error Loading Document');
      setDocumentContent('Failed to load document. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    
    // Prevent multiple simultaneous saves
    if (isSaving) {
      console.log('Save already in progress, skipping...');
      return;
    }
    
    setIsSaving(true);
    try {
      console.log('Save triggered:', {
        documentId,
        currentDocumentId,
        isNew: documentId === 'new' && !currentDocumentId,
        title: documentTitle,
        contentLength: documentContent.length
      });

      if (documentId === 'new' && !currentDocumentId) {
        console.log('Creating new document with title:', documentTitle, 'content length:', documentContent.length);
        // Create new document
        const newDocumentId = await documentService.createDocument(
          user.uid,
          documentTitle,
          documentContent
        );
        console.log('New document created with ID:', newDocumentId);
        
        // Update the current document ID state
        setCurrentDocumentId(newDocumentId);
        
        // Mark that we just created this document
        justCreatedRef.current = true;
        
        // Update URL to reflect the new document ID
        navigate(`/document/${newDocumentId}`, { replace: true });
      } else {
        // Update existing document
        const docIdToUpdate = currentDocumentId || documentId;
        console.log('Updating existing document:', docIdToUpdate, 'with title:', documentTitle, 'content length:', documentContent.length);
        
        if (docIdToUpdate && docIdToUpdate !== 'new') {
          await documentService.updateDocument(
            docIdToUpdate,
            user.uid,
            {
              title: documentTitle,
              content: documentContent
            }
          );
          console.log('Document updated successfully');
        }
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setDocumentContent(newContent);
    
    // Validate and clean suggestions whenever content changes
    if (suggestions.length > 0) {
      console.log('Content changed, validating existing suggestions...', {
        newContentLength: newContent.length,
        newContent: newContent,
        existingSuggestions: suggestions.length
      });
      
      // If content is empty or very short, clear all suggestions immediately
      if (newContent.trim().length < 3) {
        console.log('Content too short, clearing all suggestions');
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
    
    // Auto-save after typing stops
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Title changed to:', e.target.value);
    setDocumentTitle(e.target.value);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleSuggestionSelect = (suggestion: Suggestion) => {
    console.log('Selecting suggestion:', suggestion);
    setSelectedSuggestion(suggestion);
    
    // Force a re-render to update highlights
    setTimeout(() => {
      // This small delay ensures the selection state has been processed
      setDocumentContent(currentContent => currentContent);
    }, 10);
  };

  const validateAndCleanSuggestions = async (currentContent: string) => {
    console.log('Validating suggestions against current content...', {
      currentContent,
      suggestionCount: suggestions.length,
      suggestions: suggestions.map(s => ({ id: s.id, originalText: s.originalText, startIndex: s.startIndex, endIndex: s.endIndex }))
    });
    
    const invalidSuggestions = [];
    
    for (const suggestion of suggestions) {
      console.log(`Checking suggestion: "${suggestion.originalText}" at indices ${suggestion.startIndex}-${suggestion.endIndex}`);
      
      const textAtIndices = currentContent.slice(suggestion.startIndex, suggestion.endIndex);
      console.log(`Text at indices: "${textAtIndices}"`);
      
      if (textAtIndices !== suggestion.originalText) {
        // Check if the original text exists anywhere in the document
        const actualIndex = currentContent.indexOf(suggestion.originalText);
        console.log(`Original text "${suggestion.originalText}" ${actualIndex === -1 ? 'NOT FOUND' : `found at index ${actualIndex}`}`);
        
        if (actualIndex === -1) {
          // Original text no longer exists, mark for removal
          invalidSuggestions.push(suggestion.id);
          console.log(`✅ Marking suggestion "${suggestion.originalText}" for removal - text no longer exists`);
        } else {
          console.log(`⚠️ Suggestion "${suggestion.originalText}" found at different index: ${actualIndex} (was ${suggestion.startIndex})`);
        }
      } else {
        console.log(`✅ Suggestion "${suggestion.originalText}" is still valid`);
      }
    }
    
    console.log(`Found ${invalidSuggestions.length} invalid suggestions to remove:`, invalidSuggestions);
    
    // Remove invalid suggestions
    for (const suggestionId of invalidSuggestions) {
      try {
        console.log(`Removing invalid suggestion ID: ${suggestionId}`);
        await rejectSuggestion(suggestionId);
      } catch (error) {
        console.error('Failed to remove invalid suggestion:', error);
      }
    }
    
    if (invalidSuggestions.length > 0) {
      console.log(`✅ Successfully removed ${invalidSuggestions.length} invalid suggestions`);
    } else {
      console.log('ℹ️ No invalid suggestions found');
    }
  };

  const handleSuggestionAccept = async (suggestion: Suggestion) => {
    try {
      console.log('DocumentEditor: Applying suggestion:', {
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        startIndex: suggestion.startIndex,
        endIndex: suggestion.endIndex,
        currentContent: documentContent,
        textAtIndices: documentContent.slice(suggestion.startIndex, suggestion.endIndex)
      });

      // Verify the suggestion is still valid against current content
      const actualTextAtIndices = documentContent.slice(suggestion.startIndex, suggestion.endIndex);
      let validStartIndex = suggestion.startIndex;
      let validEndIndex = suggestion.endIndex;
      
      if (actualTextAtIndices !== suggestion.originalText) {
        console.warn('DocumentEditor: Suggestion indices are stale, text has changed');
        console.log('Expected:', suggestion.originalText);
        console.log('Found at indices:', actualTextAtIndices);
        
        // Try to find the correct position of the original text
        const actualIndex = documentContent.indexOf(suggestion.originalText);
        if (actualIndex === -1) {
          console.error('DocumentEditor: Original text not found in current content, cannot apply suggestion');
          console.log('Current content:', documentContent);
          console.log('Looking for:', suggestion.originalText);
          
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
          newEnd: validEndIndex,
          foundText: documentContent.slice(validStartIndex, validEndIndex)
        });
      }

      // Apply the suggestion to the document content using valid indices
      const newContent = 
        documentContent.slice(0, validStartIndex) +
        suggestion.suggestedText +
        documentContent.slice(validEndIndex);
      
      console.log('DocumentEditor: Applying text replacement:', {
        before: documentContent.slice(Math.max(0, validStartIndex - 20), validStartIndex + 20),
        replacing: documentContent.slice(validStartIndex, validEndIndex),
        with: suggestion.suggestedText,
        after: newContent.slice(Math.max(0, validStartIndex - 20), validStartIndex + suggestion.suggestedText.length + 20)
      });
      
      // Update the document content
      setDocumentContent(newContent);
      setSelectedSuggestion(null);
      
      // Clear all remaining suggestions since indices are now invalid
      // The re-analysis will generate fresh suggestions with correct indices
      console.log('DocumentEditor: Clearing all suggestions due to text change');
      suggestions.forEach(s => {
        if (s.id !== suggestion.id) {
          rejectSuggestion(s.id).catch(error => {
            console.error('Failed to clear stale suggestion:', error);
          });
        }
      });
      
      // Trigger fresh analysis after a short delay to let the text update settle
      setTimeout(async () => {
        if (newContent.trim().length > 3 && user && (currentDocumentId || documentId)) {
          console.log('Triggering fresh analysis after suggestion acceptance...');
          try {
            await requestAnalysis({
              documentId: currentDocumentId || documentId || '',
              userId: user.uid,
              content: newContent,
              analysisType: 'full'
            });
            console.log('Fresh analysis triggered successfully');
          } catch (error) {
            console.error('Failed to trigger fresh analysis:', error);
          }
        }
      }, 1000); // Wait 1 second for content to settle
      
      // Auto-save the change
      setTimeout(() => handleSave(), 500);
      
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
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
    console.log('Tags changed, forcing re-render');
  };

  const handleSectionClick = (section: EssaySection) => {
    setSelectedSection(section);
    
    // Calculate the position of the section in the document
    const sectionStart = section.startIndex;
    const sectionEnd = section.endIndex;
    
    // Focus on the text editor using a more general approach
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(sectionStart, sectionEnd);
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
                  onClick={() => setShowRubricManager(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Rubrics
                </button>
                
                <button
                  onClick={handleSave}
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
                  <ParagraphTaggingControls />
                </div>
                
                {/* Text Editor with scrolling */}
                <div className="flex-1 overflow-y-auto">
                  <TextEditor 
                    documentId={currentDocumentId || documentId || ''}
                    userId={user?.uid}
                    initialContent={documentContent}
                    onContentChange={handleContentChange}
                    selectedSuggestion={selectedSuggestion}
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