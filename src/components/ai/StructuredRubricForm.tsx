import React, { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import type { AssignmentRubric, RubricCriterion, RubricLevel } from '../../types/suggestion';

interface StructuredRubricFormProps {
  documentId: string;
  userId: string;
  onSave: (rubric: Omit<AssignmentRubric, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const StructuredRubricForm: React.FC<StructuredRubricFormProps> = ({
  documentId,
  userId,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [totalPoints, setTotalPoints] = useState<number | ''>('');
  const [assignmentType, setAssignmentType] = useState<AssignmentRubric['assignmentType']>('essay');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addCriterion = () => {
    const newCriterion: RubricCriterion = {
      id: generateId(),
      name: '',
      description: '',
      maxScore: 4,
      weight: 1,
      levels: [
        { id: generateId(), score: 4, description: 'Excellent' },
        { id: generateId(), score: 3, description: 'Good' },
        { id: generateId(), score: 2, description: 'Fair' },
        { id: generateId(), score: 1, description: 'Poor' }
      ],
      expectedElements: [],
      type: 'quality'
    };
    setCriteria([...criteria, newCriterion]);
  };

  const updateCriterion = (criterionId: string, updates: Partial<RubricCriterion>) => {
    setCriteria(criteria.map(c => 
      c.id === criterionId ? { ...c, ...updates } : c
    ));
  };

  const deleteCriterion = (criterionId: string) => {
    setCriteria(criteria.filter(c => c.id !== criterionId));
  };

  const addLevel = (criterionId: string) => {
    const newLevel: RubricLevel = {
      id: generateId(),
      score: 0,
      description: ''
    };
    
    setCriteria(criteria.map(c => 
      c.id === criterionId 
        ? { ...c, levels: [...c.levels, newLevel] }
        : c
    ));
  };

  const updateLevel = (criterionId: string, levelId: string, updates: Partial<RubricLevel>) => {
    setCriteria(criteria.map(c => 
      c.id === criterionId
        ? {
            ...c,
            levels: c.levels.map(l => 
              l.id === levelId ? { ...l, ...updates } : l
            )
          }
        : c
    ));
  };

  const deleteLevel = (criterionId: string, levelId: string) => {
    setCriteria(criteria.map(c => 
      c.id === criterionId
        ? { ...c, levels: c.levels.filter(l => l.id !== levelId) }
        : c
    ));
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a rubric title');
      return;
    }

    if (criteria.length === 0) {
      alert('Please add at least one criterion');
      return;
    }

    // Validate criteria
    for (const criterion of criteria) {
      if (!criterion.name.trim()) {
        alert('Please fill in all criterion names');
        return;
      }
      if (criterion.levels.length === 0) {
        alert('Each criterion must have at least one scoring level');
        return;
      }
    }

    const rubric: Omit<AssignmentRubric, 'id' | 'createdAt' | 'updatedAt'> = {
      documentId,
      userId,
      title: title.trim(),
      criteria: criteria.map(c => ({
        ...c,
        weight: 1 / criteria.length // Equal weight for all criteria
      })),
      assignmentType,
      isStructured: true,
      extractedRequirements: {}
    };

    if (totalPoints !== '') {
      rubric.totalPoints = Number(totalPoints);
    }

    onSave(rubric);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Structured Rubric</h2>
        
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rubric Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter rubric title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Points (Optional)
            </label>
            <input
              type="number"
              value={totalPoints}
              onChange={(e) => setTotalPoints(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g., 100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Type
            </label>
            <select
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value as AssignmentRubric['assignmentType'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="essay">Essay</option>
              <option value="reflection">Reflection</option>
              <option value="report">Report</option>
              <option value="research-paper">Research Paper</option>
              <option value="creative-writing">Creative Writing</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Criteria Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Criteria</h3>
          <button
            onClick={addCriterion}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Criterion
          </button>
        </div>

        {criteria.length === 0 ? (
          <div className="text-center p-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            <p>No criteria added yet. Click "Add Criterion" to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {criteria.map((criterion, criterionIndex) => (
              <div key={criterion.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">
                    Criterion {criterionIndex + 1}
                  </h4>
                  <button
                    onClick={() => deleteCriterion(criterion.id)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Criterion Name *
                    </label>
                    <input
                      type="text"
                      value={criterion.name}
                      onChange={(e) => updateCriterion(criterion.id, { name: e.target.value })}
                      placeholder="e.g., Content Quality"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Score
                    </label>
                    <input
                      type="number"
                      value={criterion.maxScore}
                      onChange={(e) => updateCriterion(criterion.id, { maxScore: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={criterion.description}
                    onChange={(e) => updateCriterion(criterion.id, { description: e.target.value })}
                    placeholder="Describe what this criterion evaluates..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Scoring Levels */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-gray-700">Scoring Levels</h5>
                    <button
                      onClick={() => addLevel(criterion.id)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      <Plus className="w-3 h-3" />
                      Add Level
                    </button>
                  </div>

                  <div className="space-y-3">
                    {criterion.levels
                      .sort((a, b) => b.score - a.score)
                      .map((level) => (
                        <div key={level.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                          <div className="w-20">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Score
                            </label>
                            <input
                              type="number"
                              value={level.score}
                              onChange={(e) => updateLevel(criterion.id, level.id, { score: Number(e.target.value) })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={level.description}
                              onChange={(e) => updateLevel(criterion.id, level.id, { description: e.target.value })}
                              placeholder="e.g., Excellent, Good, Fair, Poor"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <button
                            onClick={() => deleteLevel(criterion.id, level.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Save className="w-4 h-4" />
          Save Rubric
        </button>
      </div>
    </div>
  );
};

export default StructuredRubricForm; 