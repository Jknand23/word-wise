import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Trash2, CheckCircle, AlertCircle, Loader, Edit } from 'lucide-react';
import { rubricService } from '../../services/rubricService';
import StructuredRubricForm from './StructuredRubricForm';
import type { AssignmentRubric, RubricCriterion } from '../../types/suggestion';

interface RubricManagerProps {
  documentId: string;
  userId: string;
  onRubricSelect?: (rubric: AssignmentRubric) => void;
  onClose?: () => void;
}

const RubricManager: React.FC<RubricManagerProps> = ({
  documentId,
  userId,
  onRubricSelect,
  onClose
}) => {
  const [rubrics, setRubrics] = useState<AssignmentRubric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [, setIsParsingRubric] = useState(false);
  const [selectedRubric, setSelectedRubric] = useState<AssignmentRubric | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRubrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const documentRubrics = await rubricService.getDocumentRubrics(documentId, userId);
      setRubrics(documentRubrics);
    } catch (error) {
      console.error('Failed to load rubrics:', error);
      setError('Failed to load rubrics');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, userId]);

  useEffect(() => {
    loadRubrics();
  }, [loadRubrics]);

  const handleSaveStructuredRubric = async (rubricData: Omit<AssignmentRubric, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setIsParsingRubric(true);
      setError(null);
      
      // Save directly to Firestore without AI parsing
      const rubricRef = await rubricService.createStructuredRubric(rubricData);
      const savedRubric: AssignmentRubric = {
        id: rubricRef.id,
        ...rubricData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setRubrics(prev => [savedRubric, ...prev]);
      setShowAddForm(false);
      
      // Auto-select the newly created rubric
      setSelectedRubric(savedRubric);
      onRubricSelect?.(savedRubric);
    } catch (error) {
      console.error('Failed to save structured rubric:', error);
      setError('Failed to save rubric. Please try again.');
    } finally {
      setIsParsingRubric(false);
    }
  };

  const handleDeleteRubric = async (rubricId: string) => {
    if (!confirm('Are you sure you want to delete this rubric?')) {
      return;
    }

    try {
      await rubricService.deleteRubric(rubricId);
      setRubrics(prev => prev.filter(r => r.id !== rubricId));
      if (selectedRubric?.id === rubricId) {
        setSelectedRubric(null);
      }
    } catch (error) {
      console.error('Failed to delete rubric:', error);
      setError('Failed to delete rubric');
    }
  };

  const handleRubricClick = (rubric: AssignmentRubric) => {
    setSelectedRubric(rubric);
    onRubricSelect?.(rubric);
  };

  const getCriterionTypeColor = (type: RubricCriterion['type']) => {
    switch (type) {
      case 'count': return 'bg-blue-100 text-blue-800';
      case 'quality': return 'bg-green-100 text-green-800';
      case 'presence': return 'bg-yellow-100 text-yellow-800';
      case 'structure': return 'bg-purple-100 text-purple-800';
      case 'tone': return 'bg-pink-100 text-pink-800';
      case 'length': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRequirements = (requirements: AssignmentRubric['extractedRequirements']) => {
    const items = [];
    
    if (requirements.wordCount) {
      const { min, max } = requirements.wordCount;
      if (min && max) {
        items.push(`${min}-${max} words`);
      } else if (min) {
        items.push(`Minimum ${min} words`);
      }
    }
    
    if (requirements.citationCount) {
      const { min, style } = requirements.citationCount;
      const citationText = min ? `${min}+ citations` : 'Citations required';
      items.push(style ? `${citationText} (${style})` : citationText);
    }
    
    if (requirements.structure?.length) {
      items.push(`Structure: ${requirements.structure.join(', ')}`);
    }
    
    if (requirements.tone) {
      items.push(`Tone: ${requirements.tone}`);
    }
    
    return items;
  };

  return (
    <div className="flex flex-col bg-white min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Assignment Rubrics</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            Create Rubric
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Rubric Forms */}
      {showAddForm && (
        <div className="border-b">
          <StructuredRubricForm
            documentId={documentId}
            userId={userId}
            onSave={handleSaveStructuredRubric}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Rubrics List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading rubrics...</span>
          </div>
        ) : rubrics.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No rubrics yet</p>
            <p className="text-sm">Add an assignment prompt or rubric to get started</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {rubrics.map((rubric) => (
              <div
                key={rubric.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedRubric?.id === rubric.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleRubricClick(rubric)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{rubric.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {rubric.assignmentType}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        Grade Level
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRubric(rubric.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Requirements Summary */}
                {Object.keys(rubric.extractedRequirements).length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Requirements:</h4>
                    <div className="flex flex-wrap gap-2">
                      {formatRequirements(rubric.extractedRequirements).map((req, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Criteria Preview */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Criteria ({rubric.criteria.length}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {rubric.criteria.slice(0, 3).map((criterion) => (
                      <div
                        key={criterion.id}
                        className={`text-xs px-2 py-1 rounded border ${getCriterionTypeColor(criterion.type)}`}
                      >
                        <div className="font-medium">{criterion.name}</div>
                        {rubric.isStructured && (
                          <div className="text-xs opacity-75">Max: {criterion.maxScore} pts</div>
                        )}
                      </div>
                    ))}
                    {rubric.criteria.length > 3 && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        +{rubric.criteria.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Points for Structured Rubrics */}
                {rubric.isStructured && rubric.totalPoints && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center text-sm text-purple-600">
                      <span className="font-medium">Total Points: {rubric.totalPoints}</span>
                    </div>
                  </div>
                )}

                {/* Rubric Type Indicator */}
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    rubric.isStructured 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rubric.isStructured ? 'Structured Rubric' : 'Text-Based Rubric'}
                  </span>
                </div>

                {selectedRubric?.id === rubric.id && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center text-sm text-blue-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Selected for analysis
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RubricManager; 