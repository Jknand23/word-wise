import React, { useState } from 'react';
import { ArrowLeft, Sparkles, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import TextEditor from '../components/ai/TextEditor';
import SuggestionsPanel from '../components/ai/SuggestionsPanel';
import type { Suggestion } from '../types/suggestion';

const Epic3Demo: React.FC = () => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [documentContent, setDocumentContent] = useState(
    `Welcome to the WriteBright AI demo! This is a very good writing tool that helps you improve your writing.

It was good. This AI-powered system can detect spelling errors, grammar mistakes, clarity issues, and suggest improvements to make your writing more engaging.

Try typing some text with intentional errors to see the AI suggestions in action. The system will analyze your content and provide real-time feedback to help you write better.`
  );

  const demoDocumentId = 'demo-document-123';

  const handleSuggestionSelect = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
  };

  const handleContentChange = (content: string) => {
    setDocumentContent(content);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary-600" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Epic 3: AI Suggestions Demo
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BookOpen className="w-4 h-4" />
              Demo Document
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)]">
        <div className="flex h-full">
          {/* Editor Section */}
          <div className="flex-1 flex flex-col">
            {/* Demo Instructions */}
            <div className="bg-blue-50 border-b border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">
                    Epic 3: AI-Enhanced Writing Suggestions
                  </h3>
                  <p className="text-sm text-blue-700 mb-2">
                    This demo showcases real-time AI suggestions for spelling, clarity, engagement, and grammar improvements.
                  </p>
                  <div className="text-xs text-blue-600 space-y-1">
                    <p>• Click "Analyze Text" to get AI suggestions for the current content</p>
                    <p>• Suggestions will appear in the right panel, categorized by type</p>
                    <p>• Click on suggestions to highlight them in the editor</p>
                    <p>• Use Accept/Reject buttons to apply or dismiss suggestions</p>
                    <p>• Try adding words like "teh", "very very good", or "It was good" to see different suggestion types</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Editor */}
            <div className="flex-1">
              <TextEditor
                documentId={demoDocumentId}
                initialContent={documentContent}
                onContentChange={handleContentChange}
                selectedSuggestion={selectedSuggestion}
                userId="demo-user-123"
              />
            </div>
          </div>

          {/* Suggestions Panel */}
          <div className="w-96 flex-shrink-0">
            <SuggestionsPanel
              documentId={demoDocumentId}
              userId="demo-user-123"
              onSuggestionSelect={handleSuggestionSelect}
            />
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="fixed bottom-4 left-4 right-4 pointer-events-none">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 pointer-events-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-red-200 border border-red-400 rounded"></div>
                  <span className="text-gray-600">Spelling Errors</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div>
                  <span className="text-gray-600">Clarity Issues</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-blue-200 border border-blue-400 rounded"></div>
                  <span className="text-gray-600">Engagement</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-orange-200 border border-orange-400 rounded"></div>
                  <span className="text-gray-600">Grammar</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-purple-200 border border-purple-400 rounded"></div>
                  <span className="text-gray-600">Tone</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-green-200 border border-green-400 rounded"></div>
                  <span className="text-gray-600">Structure</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-indigo-200 border border-indigo-400 rounded"></div>
                  <span className="text-gray-600">Depth</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-pink-200 border border-pink-400 rounded"></div>
                  <span className="text-gray-600">Vocabulary</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Epic 3: AI Suggestions System
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Epic3Demo; 