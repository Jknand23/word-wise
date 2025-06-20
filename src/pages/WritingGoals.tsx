import React, { useState } from 'react';
import { ArrowLeft, Target, BookOpen, GraduationCap, FileText, RefreshCw, Save, Sparkles, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWritingGoalsStore, type AcademicLevel, type AssignmentType } from '../store/writingGoalsStore';

const WritingGoals: React.FC = () => {
  const navigate = useNavigate();
  const {
    goals,
    setAcademicLevel,
    setAssignmentType,
    setCustomInstructions,
    resetToDefaults,
    getGrammarStrictness,
    getVocabularyLevel,
    getToneRecommendation,
  } = useWritingGoalsStore();

  const [showPreview, setShowPreview] = useState(false);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const academicLevels: { value: AcademicLevel; label: string; description: string }[] = [
    {
      value: 'middle-school',
      label: 'Middle School',
      description: 'Grades 6-8: Focus on clear expression and basic argument structure'
    },
    {
      value: 'high-school',
      label: 'High School',
      description: 'Grades 9-12: Develop analytical thinking and formal writing skills'
    },
    {
      value: 'undergrad',
      label: 'Undergraduate',
      description: 'College level: Advanced analysis, research, and academic writing'
    }
  ];

  const assignmentTypes: { value: AssignmentType; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'essay',
      label: 'Essay',
      description: 'Argumentative, analytical, or persuasive writing with thesis and evidence',
      icon: <FileText className="h-5 w-5" />
    },
    {
      value: 'reflection',
      label: 'Reflection',
      description: 'Personal insights, experiences, and thoughtful self-examination',
      icon: <User className="h-5 w-5" />
    },
    {
      value: 'report',
      label: 'Report',
      description: 'Factual, objective presentation of information and findings',
      icon: <BookOpen className="h-5 w-5" />
    }
  ];

  return (
    <div className="min-h-screen bg-encouraging-gradient">
      {/* Navigation */}
      <nav className="navbar-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="btn-secondary text-sm py-2 px-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-blue to-accent-indigo rounded-2xl flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold gradient-text">Writing Goals</h1>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="btn-secondary text-sm py-2 px-4"
              >
                <Settings className="h-4 w-4 mr-2" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <button
                onClick={resetToDefaults}
                className="btn-secondary text-sm py-2 px-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-accent-blue to-accent-indigo rounded-3xl flex items-center justify-center mx-auto mb-6 floating-element shadow-warm">
            <Target className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-bold encouraging-text mb-4">
            Personalize Your Writing Experience ✨
          </h2>
          <p className="text-xl encouraging-text max-w-3xl mx-auto">
            Help us tailor our suggestions to your academic level and writing goals. 
            Your preferences will adjust grammar strictness, vocabulary recommendations, and tone guidance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-2 space-y-8">
            {/* Academic Level Section */}
            <div className="warm-card animate-slide-up">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-emerald to-accent-forest rounded-2xl flex items-center justify-center mr-4">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold encouraging-text">Academic Level</h3>
                  <p className="text-gray-600 encouraging-text">Choose your current education level</p>
                </div>
              </div>

              <div className="space-y-3">
                {academicLevels.map((level) => (
                  <div
                    key={level.value}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                      goals.academicLevel === level.value
                        ? 'border-accent-emerald bg-accent-emerald/10 shadow-md'
                        : 'border-gray-200 hover:border-accent-emerald/50 hover:bg-gray-50'
                    }`}
                    onClick={() => setAcademicLevel(level.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold encouraging-text text-lg">{level.label}</h4>
                        <p className="text-sm text-gray-600 encouraging-text mt-1">{level.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 ${
                        goals.academicLevel === level.value
                          ? 'border-accent-emerald bg-accent-emerald'
                          : 'border-gray-300'
                      }`}>
                        {goals.academicLevel === level.value && (
                          <div className="w-full h-full rounded-full bg-white scale-50" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignment Type Section */}
            <div className="warm-card animate-slide-up">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-teal to-accent-cyan rounded-2xl flex items-center justify-center mr-4">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold encouraging-text">Assignment Type</h3>
                  <p className="text-gray-600 encouraging-text">What type of writing are you working on?</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assignmentTypes.map((type) => (
                  <div
                    key={type.value}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 text-center ${
                      goals.assignmentType === type.value
                        ? 'border-accent-teal bg-accent-teal/10 shadow-md'
                        : 'border-gray-200 hover:border-accent-teal/50 hover:bg-gray-50'
                    }`}
                    onClick={() => setAssignmentType(type.value)}
                  >
                    <div className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${
                      goals.assignmentType === type.value
                        ? 'bg-accent-teal text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {type.icon}
                    </div>
                    <h4 className="font-semibold encouraging-text text-lg mb-2">{type.label}</h4>
                    <p className="text-sm text-gray-600 encouraging-text">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="warm-card animate-slide-up">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-coral to-warm-400 rounded-2xl flex items-center justify-center mr-4">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold encouraging-text">Custom Instructions</h3>
                  <p className="text-gray-600 encouraging-text">Any specific requirements or preferences? (Optional)</p>
                </div>
              </div>

              <textarea
                value={goals.customInstructions || ''}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Focus on creative vocabulary, avoid contractions, emphasize clear transitions..."
                className="w-full p-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-coral/50 focus:border-accent-coral resize-none encouraging-text"
                rows={4}
              />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className={`warm-card sticky top-24 animate-slide-up ${showPreview ? '' : 'hidden lg:block'}`}>
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-blue to-accent-indigo rounded-2xl flex items-center justify-center mr-4">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold encouraging-text">AI Settings Preview</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold encouraging-text mb-2 flex items-center">
                    <span className="w-2 h-2 bg-accent-emerald rounded-full mr-2"></span>
                    Grammar Strictness
                  </h4>
                  <div className="bg-soft-cream/50 rounded-xl p-3">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {getGrammarStrictness()}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold encouraging-text mb-2 flex items-center">
                    <span className="w-2 h-2 bg-accent-teal rounded-full mr-2"></span>
                    Vocabulary Level
                  </h4>
                  <div className="bg-soft-cream/50 rounded-xl p-3">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {getVocabularyLevel()}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold encouraging-text mb-2 flex items-center">
                    <span className="w-2 h-2 bg-accent-coral rounded-full mr-2"></span>
                    Tone Guidance
                  </h4>
                  <div className="bg-soft-cream/50 rounded-xl p-3">
                    <p className="text-sm text-gray-700 encouraging-text">
                      {getToneRecommendation()}
                    </p>
                  </div>
                </div>

                {goals.customInstructions && (
                  <div>
                    <h4 className="font-semibold encouraging-text mb-2 flex items-center">
                      <span className="w-2 h-2 bg-accent-blue rounded-full mr-2"></span>
                      Custom Instructions
                    </h4>
                    <div className="bg-soft-cream/50 rounded-xl p-3">
                      <p className="text-sm text-gray-700 encouraging-text">
                        {goals.customInstructions}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 p-4 bg-gradient-to-r from-accent-blue/10 to-accent-indigo/10 rounded-xl border border-accent-blue/20">
                <div className="flex items-center mb-2">
                  <Sparkles className="h-4 w-4 text-accent-blue mr-2" />
                  <span className="text-sm font-medium text-accent-blue">Smart Adaptation</span>
                </div>
                <p className="text-xs text-gray-600 encouraging-text">
                  These settings will automatically adjust all AI suggestions to match your academic level and writing goals.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center mt-12 animate-fade-in">
          <div className="success-badge inline-flex items-center">
            <Save className="h-4 w-4 mr-2" />
            Settings saved automatically! ✨
          </div>
          <p className="text-sm text-gray-600 mt-2 encouraging-text">
            Your preferences are applied to all your writing sessions
          </p>
        </div>
      </div>
    </div>
  );
};

export default WritingGoals; 