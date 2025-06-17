import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles, BookOpen, Shield, Star } from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      await authService.signInWithEmail(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-encouraging-gradient flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center animate-fade-in mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-teal to-accent-cyan mx-auto mb-6 flex items-center justify-center shadow-xl">
            <BookOpen className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Welcome Back! 🌟</h2>
          <p className="text-lg text-gray-600 mb-6 text-center">
            Sign in to continue your writing journey
          </p>
          
          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4 sm:gap-6 mb-8">
            <div className="flex items-center justify-center text-sm text-gray-600">
              <Shield className="h-4 w-4 text-accent-sage mr-2" />
              <span>Your work stays private</span>
            </div>
            <div className="flex items-center justify-center text-sm text-gray-600">
              <Star className="h-4 w-4 text-accent-teal mr-2" />
              <span>AI-powered writing help</span>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="warm-card animate-slide-up">
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="w-full">
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative w-full">
                  <Mail className="h-5 w-5 text-accent-teal absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="warm-input pl-12 w-full"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative w-full">
                  <Lock className="h-5 w-5 text-accent-teal absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="warm-input pl-12 w-full"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="warm-card bg-red-50 border border-red-200 p-4 text-center">
                <p className="text-red-600 text-sm flex items-center justify-center">
                  <span className="mr-2">⚠️</span>
                  {error}
                </p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="warm-button w-full flex justify-center items-center py-3 px-4 text-sm font-medium"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <LogIn className="h-5 w-5 mr-2" />
                )}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                New to WriteBright AI?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-accent-teal hover:text-accent-ocean transition-colors"
                >
                  Create your account →
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Features Highlight */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center space-x-2 text-sm encouraging-text bg-soft-cream/50 rounded-2xl p-3">
              <BookOpen className="h-4 w-4 text-accent-teal" />
              <span>Gentle Writing Help</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm encouraging-text bg-soft-cream/50 rounded-2xl p-3">
              <Sparkles className="h-4 w-4 text-accent-blue" />
              <span>Supportive Feedback</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 max-w-sm mx-auto encouraging-text text-center">
            Perfect for essays, stories, and expressing your unique voice with AI assistance! 🌟
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 