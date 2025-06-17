import { useState, useEffect } from 'react';
import { LogOut, FileText, Settings, User, Trash2, BookOpen, Target, Zap, TrendingUp, Award, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { documentService, type Document } from '../../services/documentService';

const Dashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalDocuments, setTotalDocuments] = useState(0);

  useEffect(() => {
    if (user?.uid) {
      loadRecentActivity();
    }
  }, [user?.uid]);

  const loadRecentActivity = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      // Load recent documents from Firestore
      const userDocuments = await documentService.getUserDocuments(user.uid);
      setTotalDocuments(userDocuments.length);
      
      // Sort by updatedAt and take the 3 most recent
      const recent = userDocuments
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 3);
      
      setRecentDocuments(recent);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleNewDocument = () => {
    navigate('/document/new');
  };

  const handleMyDocuments = () => {
    navigate('/documents');
  };

  const handleOpenDocument = (documentId: string) => {
    navigate(`/document/${documentId}`);
  };

  const handleDeleteDocument = async (documentId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the document
    
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      try {
        if (!user?.uid) return;
        
        // Delete the document from Firestore
        await documentService.deleteDocument(documentId, user.uid);
        
        // Refresh the recent documents list
        loadRecentActivity();
      } catch (error) {
        console.error('Failed to delete document:', error);
        alert('Failed to delete document. Please try again.');
      }
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const getMotivationalMessage = () => {
    const messages = [
      "Ready to craft your next masterpiece? ✨",
      "Every great writer started with a single word! 🌟",
      "Your ideas deserve to shine bright! 💫",
      "Time to turn thoughts into brilliant words! 📚",
      "Let's make your writing goals a reality! 🌈",
      "Ready to bring your ideas to life? 💪"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  return (
    <div className="min-h-screen bg-encouraging-gradient">
      {/* Warm Navigation */}
      <nav className="navbar-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-warm-400 to-accent-coral rounded-2xl flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold gradient-text">WriteBright AI</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 px-4 py-2 bg-soft-cream/60 rounded-full backdrop-blur-sm border border-warm-200/50">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-sage to-accent-coral rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium encouraging-text">
                  {user?.displayName || user?.email?.split('@')[0] || 'Writer'}
                </span>
              </div>
              
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-soft-cream/50 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:block">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="hero-section py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-fade-in">
            <h2 className="text-4xl sm:text-5xl font-extrabold encouraging-text mb-4">
              Welcome back, <span className="gradient-text">{user?.displayName?.split(' ')[0] || 'Writer'}</span>! 🌟
            </h2>
            <p className="text-xl motivational-text mb-2 max-w-3xl mx-auto">
              {getMotivationalMessage()}
            </p>
            <p className="text-lg encouraging-text max-w-2xl mx-auto">
              Your AI writing assistant is here to help you excel with smart suggestions and real-time feedback.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
            <div className="warm-card text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-teal to-accent-cyan p-3 text-white shadow-lg mx-auto mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold encouraging-text mb-1">{totalDocuments}</h3>
              <p className="motivational-text">Documents Created</p>
              <p className="text-sm text-gray-600 mt-2">Keep up the great work! 📈</p>
            </div>
            
            <div className="warm-card text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-emerald to-accent-forest p-3 text-white shadow-lg mx-auto mb-4">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold encouraging-text mb-1">
                {recentDocuments.length > 0 ? '🔥' : '🎯'}
              </h3>
              <p className="motivational-text">
                {recentDocuments.length > 0 ? 'Writing Streak' : 'Ready to Start'}
              </p>
              <p className="text-sm text-gray-600 mt-2">You're making progress! ✨</p>
            </div>
            
            <div className="warm-card text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-indigo p-3 text-white shadow-lg mx-auto mb-4">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold encouraging-text mb-1">⭐</h3>
              <p className="motivational-text">AI Writing Assistant</p>
              <p className="text-sm text-gray-600 mt-2">Here to help! 🤗</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Quick Actions */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold encouraging-text mb-6 flex items-center">
            <Zap className="h-6 w-6 text-accent-teal mr-2" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card-interactive group" onClick={handleNewDocument}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-teal to-accent-cyan p-3 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="success-badge">Start Writing 📝</div>
              </div>
              <h4 className="text-xl font-bold encouraging-text mb-2">New Document</h4>
              <p className="text-gray-600 mb-4 encouraging-text">
                Start writing with AI-powered suggestions and real-time feedback to improve your work.
              </p>
              <div className="text-accent-teal font-medium flex items-center">
                Create Now <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            <div className="card-interactive group" onClick={handleMyDocuments}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-emerald to-accent-forest p-3 text-white shadow-lg group-hover:scale-110 transition-transform duration-200">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="warning-badge">{totalDocuments} docs 📚</div>
              </div>
              <h4 className="text-xl font-bold encouraging-text mb-2">My Documents</h4>
              <p className="text-gray-600 mb-4 encouraging-text">
                Access and continue working on your saved documents. All your progress is automatically saved.
              </p>
              <div className="text-accent-emerald font-medium flex items-center">
                View All <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            <div className="warm-card relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-gradient-to-r from-accent-blue to-accent-indigo text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg border-2 border-white">
                Feature in Development 🚀
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-indigo p-3 text-white shadow-lg">
                  <Target className="h-6 w-6" />
                </div>
              </div>
              <h4 className="text-xl font-bold encouraging-text mb-2">Writing Goals</h4>
              <p className="text-gray-600 mb-4 encouraging-text">
                Set daily writing targets, track your progress, and earn achievements as you develop your skills.
              </p>
              <div className="text-accent-blue font-medium">
                Coming Soon ✨
              </div>
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        {recentDocuments.length > 0 && (
          <div className="animate-slide-up">
            <h3 className="text-2xl font-bold encouraging-text mb-6 flex items-center">
              <BookOpen className="h-6 w-6 text-accent-emerald mr-2" />
              Your Recent Work 📖
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="card-interactive group"
                  onClick={() => handleOpenDocument(doc.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-teal to-accent-cyan p-2 text-white shadow-md">
                      <FileText className="h-6 w-6" />
                    </div>
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <h4 className="font-semibold encouraging-text mb-2 group-hover:text-accent-teal transition-colors">
                    {doc.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2 encouraging-text">
                    {doc.content.substring(0, 100)}...
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {formatRelativeTime(doc.updatedAt)}
                    </span>
                    <span className="text-accent-teal font-medium">
                      Continue →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for New Users */}
        {!isLoading && recentDocuments.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-24 h-24 bg-gradient-to-br from-accent-teal to-accent-cyan rounded-full flex items-center justify-center mx-auto mb-6 floating-element shadow-warm">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold encouraging-text mb-4">Ready to Begin Your Writing Adventure? 🌟</h3>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto encouraging-text">
              Create your first document and discover the joy of writing with gentle AI guidance. Perfect for essays, stories, and sharing your thoughts with the world!
            </p>
            <button
              onClick={handleNewDocument}
              className="encouraging-button text-lg px-8 py-4"
            >
              Start Your First Document 🌈
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 