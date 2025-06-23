import { create } from 'zustand';
import { paragraphTagService } from '../services/paragraphTagService';
import type { ParagraphTag, TaggingState } from '../types/suggestion';

interface ParagraphTagStore extends TaggingState {
  // Actions
  loadTags: (documentId: string, userId: string) => Promise<void>;
  createTag: (
    documentId: string,
    userId: string,
    paragraphIndex: number,
    fullDocumentContent: string,
    tagType: 'needs-review' | 'done',
    note?: string
  ) => Promise<void>;
  updateTag: (
    tagId: string,
    updates: {
      tagType?: 'needs-review' | 'done';
      note?: string;
    }
  ) => Promise<void>;
  removeTag: (tagId: string) => Promise<void>;
  clearAllTags: (documentId: string, userId: string) => Promise<void>;
  setFilter: (filter: 'all' | 'needs-review' | 'done' | null) => void;
  validateTags: (documentId: string, userId: string, content: string) => Promise<void>;
  clearTags: () => void;
  getTagByParagraph: (paragraphIndex: number) => ParagraphTag | null;
  getFilteredTags: () => ParagraphTag[];
}

export const useParagraphTagStore = create<ParagraphTagStore>((set, get) => ({
  // Initial state
  tags: [],
  filteredByTag: 'all',
  isLoading: false,
  error: null,

  // Actions
  loadTags: async (documentId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const tags = await paragraphTagService.getDocumentTags(documentId, userId);
      set({ tags, isLoading: false });
    } catch (error) {
      console.error('Failed to load tags:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load tags',
        isLoading: false 
      });
    }
  },

  createTag: async (
    documentId: string,
    userId: string,
    paragraphIndex: number,
    fullDocumentContent: string,
    tagType: 'needs-review' | 'done',
    note?: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      // Extract paragraph bounds from the full text
      const paragraphs = paragraphTagService.extractParagraphs(fullDocumentContent);
      if (paragraphIndex >= paragraphs.length) {
        throw new Error('Invalid paragraph index');
      }
      
      const paragraph = paragraphs[paragraphIndex];
      
      const tagId = await paragraphTagService.createTag(
        documentId,
        userId,
        paragraphIndex,
        paragraph.startIndex,
        paragraph.endIndex,
        paragraph.text,
        tagType,
        note
      );

      // Add the new tag to the store
      const newTag: ParagraphTag = {
        id: tagId,
        documentId,
        userId,
        paragraphIndex,
        startIndex: paragraph.startIndex,
        endIndex: paragraph.endIndex,
        text: paragraph.text,
        tagType,
        note: note || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set(state => ({
        tags: [...state.tags, newTag].sort((a, b) => a.paragraphIndex - b.paragraphIndex),
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to create tag:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create tag',
        isLoading: false 
      });
    }
  },

  updateTag: async (tagId: string, updates: { tagType?: 'needs-review' | 'done'; note?: string }) => {
    set({ isLoading: true, error: null });
    try {
      await paragraphTagService.updateTag(tagId, updates);
      
      set(state => ({
        tags: state.tags.map(tag => 
          tag.id === tagId 
            ? { ...tag, ...updates, updatedAt: new Date() }
            : tag
        ),
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to update tag:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update tag',
        isLoading: false 
      });
    }
  },

  removeTag: async (tagId: string) => {
    set({ isLoading: true, error: null });
    try {
      await paragraphTagService.deleteTag(tagId);
      
      set(state => ({
        tags: state.tags.filter(tag => tag.id !== tagId),
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to remove tag:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to remove tag',
        isLoading: false 
      });
    }
  },

  clearAllTags: async (documentId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { tags } = get();
      const tagsToDelete = tags.filter(t => t.documentId === documentId && t.userId === userId);
      await Promise.all(tagsToDelete.map(t => paragraphTagService.deleteTag(t.id)));
      set({ tags: [], isLoading: false, filteredByTag: 'all' });
    } catch (error) {
      console.error('Failed to clear all tags:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to clear tags',
        isLoading: false
      });
    }
  },

  setFilter: (filter: 'all' | 'needs-review' | 'done' | null) => {
    set({ filteredByTag: filter });
  },

  validateTags: async (documentId: string, userId: string, content: string) => {
    try {
      const { validTags, removedTagIds } = await paragraphTagService.validateTags(
        documentId, 
        userId, 
        content
      );
      
      set({ tags: validTags });
      
      if (removedTagIds.length > 0) {
        console.log(`Removed ${removedTagIds.length} invalid tags due to content changes`);
      }
    } catch (error) {
      console.error('Failed to validate tags:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to validate tags' });
    }
  },

  clearTags: () => {
    set({ tags: [], filteredByTag: 'all', isLoading: false, error: null });
  },

  getTagByParagraph: (paragraphIndex: number) => {
    const { tags } = get();
    return tags.find(tag => tag.paragraphIndex === paragraphIndex) || null;
  },

  getFilteredTags: () => {
    const { tags, filteredByTag } = get();
    
    if (!filteredByTag || filteredByTag === 'all') {
      return tags;
    }
    
    return tags.filter(tag => tag.tagType === filteredByTag);
  },
})); 