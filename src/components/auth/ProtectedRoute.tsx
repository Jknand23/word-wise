import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading, error } = useAuthStore();

  console.log('ProtectedRoute - User:', user?.email || 'No user', 'Loading:', isLoading, 'Error:', error);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute - Redirecting to login (no user)');
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute - User authenticated, showing protected content');
  return <>{children}</>;
};

export default ProtectedRoute; 