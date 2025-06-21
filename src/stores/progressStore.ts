import { create } from 'zustand';
import { progressService, type ProgressData } from '../services/progressService';

interface ProgressStore {
  // State
  progressData: ProgressData | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProgress: (userId: string) => Promise<void>;
  setWeeklyGoal: (userId: string, goal: number) => Promise<void>;
  refreshStreak: (userId: string) => Promise<void>;
  clearProgress: () => void;
  setError: (error: string | null) => void;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  // Initial state
  progressData: null,
  isLoading: false,
  error: null,

  // Load user's progress data
  loadProgress: async (userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const progressData = await progressService.getProgressData(userId);
      set({ progressData, isLoading: false });
    } catch (error) {
      console.error('Failed to load progress:', error);
      set({ 
        error: 'Failed to load progress data', 
        isLoading: false 
      });
    }
  },

  // Set user's weekly writing goal
  setWeeklyGoal: async (userId: string, goal: number) => {
    console.log('ProgressStore: Setting weekly goal to:', goal);
    try {
      await progressService.setWeeklyGoal(userId, goal);
      console.log('ProgressStore: Firebase update completed');
      
      // Update the local state immediately
      const currentData = get().progressData;
      console.log('ProgressStore: Current data before update:', currentData);
      if (currentData) {
        const newData = {
          ...currentData,
          weeklyGoal: goal
        };
        console.log('ProgressStore: Setting new data:', newData);
        set({
          progressData: newData
        });
      }
      
      // Also reload full progress data to ensure consistency
      setTimeout(() => {
        console.log('ProgressStore: Reloading progress data for consistency');
        get().loadProgress(userId);
      }, 500);
    } catch (error) {
      console.error('Failed to set weekly goal:', error);
      set({ error: 'Failed to update weekly goal' });
    }
  },

  // Clear progress data (on logout)
  clearProgress: () => {
    set({
      progressData: null,
      isLoading: false,
      error: null
    });
  },

  // Refresh just the streak data
  refreshStreak: async (userId: string) => {
    try {
      const currentStreak = await progressService.getCurrentStreak(userId);
      const currentData = get().progressData;
      if (currentData) {
        set({
          progressData: {
            ...currentData,
            currentStreak
          }
        });
      }
    } catch (error) {
      console.error('Failed to refresh streak:', error);
      set({ error: 'Failed to refresh streak data' });
    }
  },

  // Set error message
  setError: (error: string | null) => {
    set({ error });
  },
})); 