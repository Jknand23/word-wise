import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, UserPlus, Sparkles, BookOpen, GraduationCap, Users, Shield } from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

const RegisterForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();



    if (password.length < 6) {
      useAuthStore.getState().setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await authService.registerWithEmail(email, password, displayName);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-encouraging-gradient flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center animate-fade-in mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-teal to-accent-cyan mx-auto mb-6 flex items-center justify-center shadow-xl">
            <Users className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Join WriteBright AI! 🚀</h2>
          <p className="text-lg text-gray-600 mb-6">
            Start your writing journey with AI-powered assistance
          </p>
          
          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-teal to-accent-cyan mx-auto mb-3 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Smart Writing Help</h3>
              <p className="text-sm text-gray-600">Real-time suggestions and feedback</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-emerald to-accent-forest mx-auto mb-3 flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Private & Secure</h3>
              <p className="text-sm text-gray-600">Your documents stay completely private</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-indigo mx-auto mb-3 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Improve Your Skills</h3>
              <p className="text-sm text-gray-600">Learn and grow with each document</p>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="warm-card animate-slide-up">
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="displayName" className="sr-only">
                  Full name
                </label>
                <div className="relative">
                  <User className="h-5 w-5 text-accent-teal absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    required
                    className="warm-input pl-12 py-4 text-base w-full"
                    placeholder="Full name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="h-5 w-5 text-accent-teal absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="warm-input pl-12 py-4 text-base w-full"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-5 w-5 text-accent-teal absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="warm-input pl-12 py-4 text-base w-full"
                    placeholder="Password (at least 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="warm-card bg-red-50 border border-red-200 p-4">
                <p className="text-red-600 text-sm flex items-center">
                  <span className="mr-2">⚠️</span>
                  {error}
                </p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="warm-button w-full flex justify-center items-center py-3 px-4 text-sm font-medium"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <UserPlus className="h-5 w-5 mr-2" />
                )}
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-accent-teal hover:text-accent-ocean transition-colors"
                >
                  Sign in →
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Features Highlight */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center space-x-2 text-sm encouraging-text bg-soft-cream/50 rounded-2xl p-3">
              <BookOpen className="h-5 w-5 text-accent-teal flex-shrink-0" />
              <span>Smart AI Help</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm encouraging-text bg-soft-cream/50 rounded-2xl p-3">
              <Sparkles className="h-5 w-5 text-accent-blue flex-shrink-0" />
              <span>Real-time Feedback</span>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="text-center space-y-4 animate-fade-in">
          <h4 className="text-lg font-semibold encouraging-text mb-4">What awaits you in our community:</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-center space-x-3 text-sm encouraging-text bg-soft-cream/70 rounded-2xl p-4 warm-shadow">
              <BookOpen className="h-5 w-5 text-warm-500 flex-shrink-0" />
              <span>Gentle AI guidance that celebrates your unique voice</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-sm encouraging-text bg-soft-cream/70 rounded-2xl p-4 warm-shadow">
              <Sparkles className="h-5 w-5 text-accent-coral flex-shrink-0" />
              <span>Supportive feedback that builds confidence</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-sm encouraging-text bg-soft-cream/70 rounded-2xl p-4 warm-shadow">
              <GraduationCap className="h-5 w-5 text-accent-sage flex-shrink-0" />
              <span>A safe space for essays, stories, and creative expression</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm; 