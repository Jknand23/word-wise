import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Share2, AlertCircle } from 'lucide-react';
import TextEditor from '../components/ai/TextEditor';
import SuggestionsPanel from '../components/ai/SuggestionsPanel';
import { useAuthStore } from '../store/authStore';
import { useSuggestionStore } from '../stores/suggestionStore';
import { documentService } from '../services/documentService';
import type { Suggestion } from '../types/suggestion';

const DocumentEditor: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const { setActiveDocument, clearSuggestions, error: suggestionError, setError, suggestions, rejectSuggestion, requestAnalysis } = useSuggestionStore();
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [documentContent, setDocumentContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [highlightsVisible, setHighlightsVisible] = useState<boolean>(true);
  
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
    setSelectedSuggestion(suggestion);
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

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-medium">Loading Editor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </button>
              
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={documentTitle}
                  onChange={handleTitleChange}
                  className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 max-w-md"
                  placeholder="Document title..."
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {lastSaved && (
                <span className="text-sm text-gray-500">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
              
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
      </header>

      {/* Error Banner */}
      {suggestionError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Text Editor - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2">
            <TextEditor 
              documentId={currentDocumentId || documentId || ''}
              userId={user?.uid}
              initialContent={documentContent}
              onContentChange={handleContentChange}
              selectedSuggestion={selectedSuggestion}
              highlightsVisible={highlightsVisible}
            />
          </div>

          {/* Suggestions Panel - Takes up 1 column on large screens */}
          <div className="lg:col-span-1">
            {user?.uid && <SuggestionsPanel
              documentId={currentDocumentId || documentId || ''}
              userId={user.uid}
              onSuggestionSelect={handleSuggestionSelect}
              onSuggestionAccept={handleSuggestionAccept}
              onToggleHighlights={handleToggleHighlights}
            />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor; 