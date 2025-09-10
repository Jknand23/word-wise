import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertCircle, MessageSquare, X, Plus } from 'lucide-react';
import { useParagraphTagStore } from '../../stores/paragraphTagStore';

interface ParagraphTaggerProps {
  documentId: string;
  userId: string;
  content: string;
  fullDocumentContent: string;
  paragraphIndex: number;
  onTagUpdate?: () => void;
}

const ParagraphTagger: React.FC<ParagraphTaggerProps> = ({
  documentId,
  userId,
  fullDocumentContent,
  paragraphIndex,
  onTagUpdate
}) => {
  const {
    getTagByParagraph,
    createTag,
    updateTag,
    removeTag,
    isLoading
  } = useParagraphTagStore();

  const [showMenu, setShowMenu] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const menuRef = useRef<HTMLDivElement>(null);
  const noteDialogRef = useRef<HTMLDivElement>(null);
  
  const existingTag = getTagByParagraph(paragraphIndex);

  useEffect(() => {
    if (existingTag?.note) {
      setNoteText(existingTag.note);
    }
  }, [existingTag]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (noteDialogRef.current && !noteDialogRef.current.contains(event.target as Node)) {
        setShowNoteDialog(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left,
      y: rect.bottom + 5
    });
    setShowMenu(!showMenu);
  };

  const handleCreateTag = async (tagType: 'needs-review' | 'done') => {
    try {
      await createTag(documentId, userId, paragraphIndex, fullDocumentContent, tagType);
      setShowMenu(false);
      onTagUpdate?.();
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleUpdateTag = async (tagType: 'needs-review' | 'done') => {
    if (!existingTag) return;
    
    try {
      await updateTag(existingTag.id, { tagType });
      setShowMenu(false);
      onTagUpdate?.();
    } catch (error) {
      console.error('Failed to update tag:', error);
    }
  };

  const handleRemoveTag = async () => {
    if (!existingTag) return;
    
    try {
      await removeTag(existingTag.id);
      setShowMenu(false);
      onTagUpdate?.();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const handleAddNote = () => {
    setShowMenu(false);
    setShowNoteDialog(true);
  };

  const handleSaveNote = async () => {
    if (!existingTag) return;
    
    try {
      await updateTag(existingTag.id, { note: noteText });
      setShowNoteDialog(false);
      onTagUpdate?.();
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleCancelNote = () => {
    setNoteText(existingTag?.note || '');
    setShowNoteDialog(false);
  };

  const getTagIcon = (tagType: 'needs-review' | 'done') => {
    switch (tagType) {
      case 'needs-review':
        return <AlertCircle className="w-3 h-3" />;
      case 'done':
        return <CheckCircle className="w-3 h-3" />;
    }
  };

  const getTagColor = (tagType: 'needs-review' | 'done') => {
    switch (tagType) {
      case 'needs-review':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200';
      case 'done':
        return 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200';
    }
  };

  return (
    <>
      {/* Tag Button */}
      <button
        onClick={handleTagClick}
        className={`
          inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-all duration-200
          ${existingTag 
            ? getTagColor(existingTag.tagType)
            : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        disabled={isLoading}
        title={existingTag ? `${existingTag.tagType === 'needs-review' ? 'Needs Review' : 'Done'}${existingTag.note ? `: ${existingTag.note}` : ''}` : 'Add tag'}
      >
        {existingTag ? (
          <>
            {getTagIcon(existingTag.tagType)}
            <span className="capitalize">
              {existingTag.tagType === 'needs-review' ? 'Review' : 'Done'}
            </span>
            {existingTag.note && <MessageSquare className="w-3 h-3" />}
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" />
            <span>Tag</span>
          </>
        )}
      </button>

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          {!existingTag ? (
            // Create new tag options
            <>
              <button
                onClick={() => handleCreateTag('needs-review')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                disabled={isLoading}
              >
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span>Needs Review</span>
              </button>
              <button
                onClick={() => handleCreateTag('done')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                disabled={isLoading}
              >
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Done</span>
              </button>
            </>
          ) : (
            // Update existing tag options
            <>
              {existingTag.tagType === 'needs-review' ? (
                <button
                  onClick={() => handleUpdateTag('done')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  disabled={isLoading}
                >
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Mark as Done</span>
                </button>
              ) : (
                <button
                  onClick={() => handleUpdateTag('needs-review')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  disabled={isLoading}
                >
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span>Needs Review</span>
                </button>
              )}
              
              <hr className="my-1 border-gray-200" />
              
              <button
                onClick={handleAddNote}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>{existingTag.note ? 'Edit Note' : 'Add Note'}</span>
              </button>
              
              <hr className="my-1 border-gray-200" />
              
              <button
                onClick={handleRemoveTag}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
                <span>Remove Tag</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Note Dialog */}
      {showNoteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            ref={noteDialogRef}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {existingTag?.note ? 'Edit Note' : 'Add Note'}
            </h3>
            
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about this paragraph..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveNote}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={handleCancelNote}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ParagraphTagger; 