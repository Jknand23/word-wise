import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type AcademicLevel = 'middle-school' | 'high-school' | 'undergrad';
export type AssignmentType = 'essay' | 'reflection' | 'report' | 'research-paper' | 'creative-writing' | 'other';

export interface WritingGoals {
  academicLevel: AcademicLevel;
  assignmentType: AssignmentType;
  customInstructions?: string;
}

interface WritingGoalsState {
  goals: WritingGoals;
  setAcademicLevel: (level: AcademicLevel) => void;
  setAssignmentType: (type: AssignmentType) => void;
  setCustomInstructions: (instructions: string) => void;
  resetToDefaults: () => void;
  getGrammarStrictness: () => 'lenient' | 'moderate' | 'strict';
  getVocabularyLevel: () => 'simple' | 'intermediate' | 'advanced';
  getToneRecommendation: () => string;
}

const defaultGoals: WritingGoals = {
  academicLevel: 'undergrad',
  assignmentType: 'essay',
  customInstructions: '',
};

export const useWritingGoalsStore = create<WritingGoalsState>()(
  devtools(
    persist(
      (set, get) => ({
        goals: defaultGoals,
        
        setAcademicLevel: (level) =>
          set((state) => ({
            goals: { ...state.goals, academicLevel: level }
          })),
        
        setAssignmentType: (type) =>
          set((state) => ({
            goals: { ...state.goals, assignmentType: type }
          })),
        
        setCustomInstructions: (instructions) =>
          set((state) => ({
            goals: { ...state.goals, customInstructions: instructions }
          })),
        
        resetToDefaults: () => set({ goals: defaultGoals }),
        
        getGrammarStrictness: () => {
          const { academicLevel } = get().goals;
          switch (academicLevel) {
            case 'middle-school':
              return 'lenient';
            case 'high-school':
              return 'moderate';
            case 'undergrad':
              return 'strict';
            default:
              return 'moderate';
          }
        },
        
        getVocabularyLevel: () => {
          const { academicLevel } = get().goals;
          switch (academicLevel) {
            case 'middle-school':
              return 'simple';
            case 'high-school':
              return 'intermediate';
            case 'undergrad':
              return 'advanced';
            default:
              return 'intermediate';
          }
        },
        
        getToneRecommendation: () => {
          const { assignmentType, academicLevel } = get().goals;
          
          if (assignmentType === 'reflection') {
            return 'Personal and thoughtful, using first-person perspective when appropriate';
          }
          
          if (assignmentType === 'report') {
            return 'Objective and factual, using clear and direct language';
          }
          
          if (assignmentType === 'research-paper') {
            return 'Academic and scholarly, with evidence-based arguments and proper citations';
          }
          
          if (assignmentType === 'creative-writing') {
            return 'Creative and expressive, focusing on narrative voice and style';
          }
          
          if (assignmentType === 'other') {
            return 'Appropriate to assignment requirements and audience';
          }
          
          // Essay tone varies by academic level
          switch (academicLevel) {
            case 'middle-school':
              return 'Clear and engaging, with simple but complete arguments';
            case 'high-school':
              return 'Formal but accessible, with well-developed arguments';
            case 'undergrad':
              return 'Academic and analytical, with sophisticated reasoning';
            default:
              return 'Formal and well-structured';
          }
        },
      }),
      {
        name: 'writing-goals-storage',
      }
    ),
    {
      name: 'writingGoalsStore',
    }
  )
); 