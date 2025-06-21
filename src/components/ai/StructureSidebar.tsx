import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, AlertCircle, ChevronRight, ChevronDown, Sparkles, Target, BookOpen, Flag, Lightbulb } from 'lucide-react';
import { suggestionService } from '../../services/suggestionService';
import { useWritingGoalsStore } from '../../store/writingGoalsStore';
import type { EssayStructure, EssaySection } from '../../types/suggestion';

interface StructureSidebarProps {
  documentId: string;
  userId: string;
  content: string;
  onSectionClick?: (section: EssaySection) => void;
  onRequestAnalysis?: () => void;
}

const StructureSidebar: React.FC<StructureSidebarProps> = ({
  documentId,
  userId,
  content,
  onSectionClick,
  onRequestAnalysis
}) => {
  const [structure, setStructure] = useState<EssayStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { goals } = useWritingGoalsStore();

  useEffect(() => {
    if (documentId && userId) {
      loadStructure();
    }
  }, [documentId, userId]);

  const loadStructure = async () => {
    try {
      const existingStructure = await suggestionService.getDocumentStructure(documentId, userId);
      setStructure(existingStructure);
    } catch (error) {
      console.error('Failed to load structure:', error);
    }
  };

  const handleAnalyzeStructure = async () => {
    if (goals.assignmentType !== 'essay') {
      setError('Structure analysis is only available for essay assignments. Please change your assignment type to "Essay" in Writing Goals.');
      return;
    }

    if (!content.trim() || content.length < 100) {
      setError('Please write more content before analyzing structure (minimum 100 characters)');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await suggestionService.requestStructureAnalysis({
        content,
        documentId,
        userId,
        assignmentType: goals.assignmentType,
        academicLevel: goals.academicLevel
      });
      
      setStructure(response.structure);
      if (onRequestAnalysis) {
        onRequestAnalysis();
      }
    } catch (error) {
      console.error('Structure analysis failed:', error);
      
      // More detailed error handling
      let errorMessage = 'Failed to analyze essay structure. Please try again.';
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error details:', error);
        
        // Check for specific error types
        if (error.message.includes('unauthenticated')) {
          errorMessage = 'Authentication required. Please refresh the page and try again.';
        } else if (error.message.includes('permission-denied')) {
          errorMessage = 'Permission denied. You can only analyze your own documents.';
        } else if (error.message.includes('invalid-argument')) {
          errorMessage = 'Invalid request. Make sure you have content to analyze and assignment type is set to Essay.';
        } else if (error.message.includes('resource-exhausted')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('unavailable')) {
          errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
        } else if (error.message) {
          errorMessage = `Analysis failed: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getSectionIcon = (sectionType: EssaySection['type']) => {
    const iconProps = { className: "w-4 h-4" };
    switch (sectionType) {
      case 'introduction':
        return <BookOpen {...iconProps} className="text-blue-600" />;
      case 'thesis':
        return <Target {...iconProps} className="text-purple-600" />;
      case 'body-paragraph':
        return <FileText {...iconProps} className="text-green-600" />;
      case 'conclusion':
        return <Flag {...iconProps} className="text-orange-600" />;
      case 'transition':
        return <ChevronRight {...iconProps} className="text-gray-500" />;
      default:
        return <FileText {...iconProps} />;
    }
  };

  const getSectionLabel = (section: EssaySection) => {
    switch (section.type) {
      case 'introduction':
        return 'Introduction';
      case 'thesis':
        return 'Thesis Statement';
      case 'body-paragraph':
        return `Body Paragraph ${section.metadata?.paragraphNumber || ''}`;
      case 'conclusion':
        return 'Conclusion';
      case 'transition':
        return 'Transition';
      default:
        return 'Section';
    }
  };

  const getStatusIcon = (section: EssaySection) => {
    if (section.isWeak) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  };

  const toggleSection = (sectionId: string) => {
    if (expandedSections.has(sectionId)) {
      // If clicking on the currently expanded section, close it
      setExpandedSections(new Set());
    } else {
      // If clicking on a different section, close all others and open this one
      setExpandedSections(new Set([sectionId]));
    }
  };

  const getStructureScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStructureScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Strong';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Essay Structure
          </h3>
          <button
            onClick={handleAnalyzeStructure}
            disabled={isLoading || goals.assignmentType !== 'essay'}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Assignment type notice */}
        {goals.assignmentType !== 'essay' && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-center mb-1">
              <AlertCircle className="w-4 h-4 text-amber-500 mr-2" />
              <span className="text-sm font-medium text-amber-700">Assignment Type: {goals.assignmentType}</span>
            </div>
            <p className="text-xs text-amber-600">
              Structure analysis is designed for essays. Change to "Essay" in Writing Goals to use this feature.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {structure && (
          <div className="mb-3 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Structure</span>
              <span className={`text-sm font-semibold ${getStructureScoreColor(structure.overallStructure.structureScore)}`}>
                {getStructureScoreLabel(structure.overallStructure.structureScore)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center">
                {structure.overallStructure.hasIntroduction ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500 mr-1" />
                )}
                Introduction
              </div>
              <div className="flex items-center">
                {structure.overallStructure.hasThesis ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500 mr-1" />
                )}
                Thesis
              </div>
              <div className="flex items-center">
                {structure.overallStructure.bodyParagraphCount > 0 ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500 mr-1" />
                )}
                Body ({structure.overallStructure.bodyParagraphCount})
              </div>
              <div className="flex items-center">
                {structure.overallStructure.hasConclusion ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500 mr-1" />
                )}
                Conclusion
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {!structure ? (
          <div className="text-center text-gray-500 py-8">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm mb-2">No structure analysis yet</p>
            <p className="text-xs text-gray-400">
              {goals.assignmentType === 'essay' 
                ? 'Click "Analyze" to identify essay sections'
                : `Structure analysis available for essays only`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Missing Elements Warning */}
            {structure.overallStructure.missingElements.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-sm font-medium text-red-700">Missing Elements</span>
                </div>
                <ul className="text-xs text-red-600 space-y-1">
                  {structure.overallStructure.missingElements.map((element, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-1">•</span>
                      {element}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Detected Sections</h4>
              {structure.sections.map((section) => (
                <div key={section.id} className="border border-gray-200 rounded-md">
                  <button
                    onClick={() => {
                      toggleSection(section.id);
                      if (onSectionClick) {
                        onSectionClick(section);
                      }
                    }}
                    className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      {getSectionIcon(section.type)}
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {getSectionLabel(section)}
                      </span>
                      {getStatusIcon(section)}
                    </div>
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expandedSections.has(section.id) && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <div className="mt-2 space-y-2">
                        {/* Section Preview */}
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          <div className="font-medium text-gray-700 mb-1">Preview:</div>
                          {section.text.substring(0, 50)}
                          {section.text.length > 50 && '...'}
                        </div>

                        {/* Word Count */}
                        <div className="text-xs text-gray-500">
                          <div className="font-medium text-gray-700 mb-1">Word Count:</div>
                          <div>{section.text.split(/\s+/).filter(word => word.length > 0).length} words</div>
                        </div>

                        {/* Strengths */}
                        <div className="text-xs">
                          <div className="font-medium text-green-700 mb-1 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Strengths:
                          </div>
                          <div className="text-green-600 space-y-1">
                            {(() => {
                              const strengths = [];
                              if (!section.isWeak) strengths.push('Well-structured content');
                              if (section.metadata?.transitionQuality === 'strong') strengths.push('Strong transitions');
                              if (section.metadata?.transitionQuality === 'moderate' && goals.academicLevel !== 'undergrad') strengths.push('Good transitions');
                              if (section.text.length > 200) strengths.push('Adequate length');
                              if (section.metadata?.evidenceCount && section.metadata.evidenceCount > 0) strengths.push('Contains supporting evidence');
                              if (section.type === 'body-paragraph' && section.metadata?.topicSentence) strengths.push('Clear topic sentence');
                              if (section.confidence > 0.8) strengths.push('Clear section identification');
                              
                              return strengths.length > 0 ? (
                                strengths.map((strength, idx) => <div key={idx}>• {strength}</div>)
                              ) : (
                                <div className="text-gray-500 italic">• No specific strengths identified</div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Weaknesses */}
                        <div className="text-xs">
                          <div className="font-medium text-red-700 mb-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Areas for Improvement:
                          </div>
                          <div className="text-red-600 space-y-1">
                            {(() => {
                              const weaknesses = [];
                              if (section.isWeak) weaknesses.push('Section needs strengthening');
                              if (section.text.length < 100) weaknesses.push('Could use more development');
                              if (section.metadata?.transitionQuality === 'weak') weaknesses.push('Weak transitions');
                              if (section.metadata?.transitionQuality === 'moderate' && goals.academicLevel === 'undergrad') weaknesses.push('Transitions need upgrading for undergraduate level');
                              if (section.metadata?.evidenceCount === 0 && section.type === 'body-paragraph') weaknesses.push('Lacks supporting evidence');
                              if (section.confidence < 0.6) weaknesses.push('Section boundaries unclear');
                              
                              return weaknesses.length > 0 ? (
                                weaknesses.map((weakness, idx) => <div key={idx}>• {weakness}</div>)
                              ) : (
                                <div className="text-gray-500 italic">• No major issues identified</div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Transition Quality Badge */}
                        {section.metadata?.transitionQuality && (
                          <div className="text-xs">
                            <div className="font-medium text-gray-700 mb-1">Transition Quality:</div>
                            <div className="flex items-center">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                section.metadata.transitionQuality === 'strong' 
                                  ? 'bg-green-100 text-green-700'
                                  : section.metadata.transitionQuality === 'moderate'
                                  ? 'bg-yellow-100 text-yellow-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {section.metadata.transitionQuality}
                              </span>
                              {goals.academicLevel === 'undergrad' && section.metadata.transitionQuality !== 'strong' && (
                                <span className="ml-1 text-red-600">⚠️</span>
                              )}
                              {goals.academicLevel === 'high-school' && section.metadata.transitionQuality === 'weak' && (
                                <span className="ml-1 text-orange-600">⚠️</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Section Suggestions */}
                        {section.suggestions && section.suggestions.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center mb-1">
                              <Lightbulb className="w-3 h-3 text-yellow-500 mr-1" />
                              <span className="text-xs font-medium text-gray-700">Suggestions</span>
                            </div>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {section.suggestions.map((suggestion, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="mr-1">•</span>
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructureSidebar; 