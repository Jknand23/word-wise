import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Search, Trash2, AlertCircle, Sparkles, Calendar, BookOpen, Filter } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { documentService, type Document } from '../services/documentService';

const MyDocuments: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt', 'createdAt', 'title'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('MyDocuments component render - user:', user?.email, 'authLoading:', authLoading);

  useEffect(() => {
    // Wait for authentication to complete before trying to load documents
    if (authLoading) {
      console.log('Authentication still loading, waiting...');
      return;
    }

    // Only load documents when we have a confirmed authenticated user
    if (user?.uid) {
      console.log('Authentication complete, user found, loading documents...');
      loadDocuments();
    } else {
      console.log('Authentication complete, no user found, setting empty documents');
      setDocuments([]);
      setIsLoading(false);
    }
  }, [user, authLoading]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading documents, user:', user);
      
      if (!user?.uid) {
        console.log('No user authenticated, returning empty documents');
        setDocuments([]);
        setIsLoading(false);
        return;
      }

      console.log('User authenticated, UID:', user.uid);

      // Test Firestore connection first
      const connectionTest = await documentService.testFirestoreConnection();
      if (!connectionTest) {
        throw new Error('Failed to connect to Firestore');
      }

      // Check if there are localStorage documents to migrate
      const hasLocalStorageDocs = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
        .some(key => key?.startsWith('document-'));
      
      if (hasLocalStorageDocs) {
        console.log('Migrating localStorage documents to Firestore...');
        try {
          await documentService.migrateLocalStorageDocuments(user.uid);
        } catch (migrationError) {
          console.warn('Migration failed, continuing with normal load:', migrationError);
        }
      }

      // Load documents from Firestore
      const userDocuments = await documentService.getUserDocuments(user.uid);
      setDocuments(userDocuments);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setError('Failed to load documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'createdAt':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'updatedAt':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        default:
          return 0;
      }
    });
  }, [filteredDocuments, sortBy]);

  const handleCreateNew = async () => {
    if (!user?.uid) return;
    
    try {
      const newDocumentId = await documentService.createDocument(
        user.uid,
        'Untitled Document',
        ''
      );
      navigate(`/document/${newDocumentId}`);
    } catch (error) {
      console.error('Failed to create document:', error);
      // Fallback to old behavior
      navigate('/document/new');
    }
  };

  const handleOpenDocument = (documentId: string) => {
    console.log('Opening document with ID:', documentId);
    navigate(`/document/${documentId}`);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleDeleteDocument = async (documentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    if (!user?.uid) return;
    
    try {
      await documentService.deleteDocument(documentId, user.uid);
      // Update state
      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDocumentPreview = (content: string) => {
    return content.length > 150 ? content.substring(0, 150) + '...' : content;
  };

  const getRandomMotivationalEmoji = () => {
    const emojis = ['🌟', '✨', '💫', '🌈', '🎨', '🌸', '💝', '🌻'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  return (
    <div className="min-h-screen bg-encouraging-gradient">
      {/* Warm Header */}
      <header className="navbar-glass sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="btn-secondary text-sm py-2 px-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-sage to-warm-400 rounded-2xl flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold gradient-text">Your Writing Collection</h1>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={loadDocuments}
                className="btn-secondary text-sm py-2 px-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-warm-400"></div>
                ) : (
                  'Refresh'
                )}
              </button>
              <button
                onClick={handleCreateNew}
                className="btn-primary text-sm py-2 px-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 flex items-center">
            <BookOpen className="h-8 w-8 text-warm-600 mr-3" />
            My Documents
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Your writing workspace. Create, edit, and manage all your documents with AI assistance.
          </p>
        </div>

        {/* Search and Actions */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="h-5 w-5 text-warm-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search your documents..."
                className="warm-input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => navigate('/editor')}
              className="warm-button flex items-center px-6 py-3"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Document
            </button>
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="mb-8 animate-fade-in">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Sort Controls */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm motivational-text">
                <Filter className="h-4 w-4" />
                <span>Sort by:</span>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="btn-secondary text-sm py-2 px-3 pr-8 appearance-none bg-soft-cream"
              >
                <option value="updatedAt">Recently Updated</option>
                <option value="createdAt">Recently Created</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-warm-400 rounded-full"></div>
                <span className="text-sm encouraging-text">
                  {documents.length} {documents.length === 1 ? 'document' : 'documents'} in your workspace
                </span>
              </div>
              {searchTerm && (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-accent-sage rounded-full"></div>
                  <span className="text-sm motivational-text">
                    {filteredDocuments.length} found matching "{searchTerm}"
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 warm-card bg-red-50 border-red-200 animate-fade-in">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <p className="text-red-800">Oops! {error}</p>
              <button
                onClick={loadDocuments}
                className="ml-auto btn-secondary text-sm py-1 px-3"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-warm-400 to-accent-coral rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-subtle shadow-warm">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg font-medium encouraging-text">Gathering your wonderful writings...</p>
              <p className="text-sm motivational-text">Almost there! 🌟</p>
            </div>
          </div>
        )}

        {/* Documents Grid */}
        {!isLoading && sortedDocuments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-slide-up">
            {sortedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="card-interactive group"
                onClick={() => handleOpenDocument(doc.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-warm-400 to-accent-coral rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                    <FileText className="h-6 w-6" />
                  </div>
                  <button
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="text-lg font-bold encouraging-text mb-2 group-hover:text-warm-600 transition-colors line-clamp-2">
                  {doc.title}
                </h3>

                {doc.content && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3 encouraging-text">
                    {getDocumentPreview(doc.content)}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(doc.updatedAt)}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-warm-600 font-medium">
                    <span>Continue writing</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>

                {/* Word count indicator */}
                {doc.content && (
                  <div className="mt-3 pt-3 border-t border-warm-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="motivational-text">{doc.content.split(' ').length} words written</span>
                      <span>{getRandomMotivationalEmoji()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredDocuments.length === 0 && !isLoading && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-warm-200 to-accent-coral/20 mx-auto mb-8 flex items-center justify-center">
              <FileText className="h-16 w-16 text-warm-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              {searchTerm ? 'No documents found' : 'Start your first document! ✨'}
            </h3>
            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              {searchTerm 
                ? `No documents match "${searchTerm}". Try a different search term.`
                : 'Create your first document and begin writing with AI assistance.'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/editor')}
                className="warm-button px-8 py-4 text-lg flex items-center mx-auto"
              >
                <Plus className="h-6 w-6 mr-3" />
                Create New Document
              </button>
            )}
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && sortedDocuments.length === 0 && searchTerm && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-20 h-20 bg-gradient-to-br from-accent-sage to-warm-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold encouraging-text mb-4">Hmm, we couldn't find "{searchTerm}" 🔍</h3>
            <p className="motivational-text mb-6">
              No worries! Try a different search or start a fresh document with that wonderful idea!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setSearchTerm('')}
                className="btn-secondary"
              >
                Clear Search
              </button>
              <button
                onClick={handleCreateNew}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDocuments; 