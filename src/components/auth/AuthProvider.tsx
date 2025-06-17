import React, { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { setLoading } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        // Set up the auth state listener
        unsubscribe = authService.initializeAuth();
        
      } catch (error) {
        console.error("Failed to initialize authentication:", error);
        // Even if initialization fails, we should still set up the listener
        unsubscribe = authService.initializeAuth();
      } finally {
        setIsInitialized(true);
        setLoading(false);
      }
    };
    
    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setLoading]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg font-semibold text-gray-700">Loading WriteBright AI...</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider; 