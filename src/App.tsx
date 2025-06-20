import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Dashboard from './components/dashboard/Dashboard';
import Epic3Demo from './pages/Epic3Demo';
import DocumentEditor from './pages/DocumentEditor';
import MyDocuments from './pages/MyDocuments';
import WritingGoals from './pages/WritingGoals';
import { useAuthStore } from './store/authStore';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<PublicRoute><LoginForm /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterForm /></PublicRoute>} />
            
            {/* Epic 3 Demo Route (Public for now) */}
            <Route path="/epic3-demo" element={<Epic3Demo />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/documents" element={
              <ProtectedRoute>
                <MyDocuments />
              </ProtectedRoute>
            } />
            
            <Route path="/document/:documentId" element={
              <ProtectedRoute>
                <DocumentEditor />
              </ProtectedRoute>
            } />
            
            <Route path="/writing-goals" element={
              <ProtectedRoute>
                <WritingGoals />
              </ProtectedRoute>
            } />
            
            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

// Component to redirect authenticated users away from auth pages
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, error } = useAuthStore();

  console.log('PublicRoute - User:', user?.email || 'No user', 'Loading:', isLoading, 'Error:', error);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  if (user) {
    console.log('PublicRoute - User authenticated, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('PublicRoute - No user, showing auth page');
  return <>{children}</>;
};

export default App;
