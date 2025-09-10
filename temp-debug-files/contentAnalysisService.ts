// Using simple hash function since crypto-js is not available in the browser
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export interface ContentChange {
  index: number;
  oldText: string;
  newText: string;
  type: 'added' | 'modified' | 'deleted';
  startIndex: number;
  endIndex: number;
}

export interface ContextWindow {
  index: number;
  text: string;
  isChanged: boolean;
  type: 'changed' | 'context' | 'summary';
  startIndex: number;
  endIndex: number;
}

export interface OptimizedAnalysisRequest {
  contextWindow: ContextWindow[];
  documentSummary?: string;
  totalParagraphs: number;
  changedParagraphCount: number;
  isFullDocument: boolean;
}

export const contentAnalysisService = {
  /**
   * Detect changed paragraphs between old and new content
   */
  detectChangedParagraphs(oldContent: string, newContent: string): ContentChange[] {
    const oldParagraphs = this.splitIntoParagraphs(oldContent);
    const newParagraphs = this.splitIntoParagraphs(newContent);
    
    const changes: ContentChange[] = [];
    let oldContentIndex = 0;
    let newContentIndex = 0;
    
    const maxLength = Math.max(oldParagraphs.length, newParagraphs.length);
    
    for (let i = 0; i < maxLength; i++) {
      const oldParagraph = oldParagraphs[i] || '';
      const newParagraph = newParagraphs[i] || '';
      
      // Calculate start indices in the original content
      const oldStartIndex = this.findParagraphStartIndex(oldContent, oldParagraph, oldContentIndex);
      const newStartIndex = this.findParagraphStartIndex(newContent, newParagraph, newContentIndex);
      
      if (oldParagraph !== newParagraph) {
        let changeType: 'added' | 'modified' | 'deleted';
        
        if (!oldParagraph && newParagraph) {
          changeType = 'added';
        } else if (oldParagraph && !newParagraph) {
          changeType = 'deleted';
        } else {
          changeType = 'modified';
        }
        
        changes.push({
          index: i,
          oldText: oldParagraph,
          newText: newParagraph,
          type: changeType,
          startIndex: changeType === 'deleted' ? oldStartIndex : newStartIndex,
          endIndex: changeType === 'deleted' 
            ? oldStartIndex + oldParagraph.length 
            : newStartIndex + newParagraph.length
        });
      }
      
      // Update content indices
      if (oldParagraph) {
        oldContentIndex = oldStartIndex + oldParagraph.length;
      }
      if (newParagraph) {
        newContentIndex = newStartIndex + newParagraph.length;
      }
    }
    
    return changes;
  },

  /**
   * Build a context window around changed paragraphs
   */
  buildContextWindow(
    paragraphs: string[], 
    changedIndices: number[], 
    contextSize: number = 3
  ): ContextWindow[] {
    if (changedIndices.length === 0) {
      // If no changes, return empty context window to skip analysis
      return [];
    }
    
    const relevantIndices = new Set<number>();
    
    // Dynamically shrink context window for large documents to speed up analysis
    const effectiveContextSize = paragraphs.length > 20 ? 0 : paragraphs.length > 12 ? 1 : contextSize;
    
    // Add changed paragraphs and their context
    changedIndices.forEach(index => {
      for (let i = Math.max(0, index - effectiveContextSize); 
           i <= Math.min(paragraphs.length - 1, index + effectiveContextSize); 
           i++) {
        relevantIndices.add(i);
      }
    });
    
    // Convert to array and sort
    const sortedIndices = Array.from(relevantIndices).sort((a, b) => a - b);
    
    // Build context window with position tracking
    return sortedIndices.map(i => {
      const paragraph = paragraphs[i];
      const startIndex = this.calculateParagraphStartIndex(paragraphs, i);
      
      return {
        index: i,
        text: paragraph,
        isChanged: changedIndices.includes(i),
        type: changedIndices.includes(i) ? 'changed' : 'context',
        startIndex,
        endIndex: startIndex + paragraph.length
      } as ContextWindow;
    });
  },

  /**
   * Generate a document summary for context
   */
  generateDocumentSummary(content: string, maxLength: number = 200): string {
    const paragraphs = this.splitIntoParagraphs(content);
    if (paragraphs.length === 0) return '';
    
    // Take first and last paragraphs for basic summary
    const firstParagraph = paragraphs[0].substring(0, maxLength / 2);
    const lastParagraph = paragraphs.length > 1 
      ? '...' + paragraphs[paragraphs.length - 1].substring(0, maxLength / 2)
      : '';
    
    const summary = (firstParagraph + ' ' + lastParagraph).trim();
    return summary.length > maxLength ? summary.substring(0, maxLength) + '...' : summary;
  },

  /**
   * Create optimized analysis request
   */
  createOptimizedRequest(
    oldContent: string,
    newContent: string,
    contextSize: number = 3
  ): OptimizedAnalysisRequest {
    const changes = this.detectChangedParagraphs(oldContent, newContent);
    const newParagraphs = this.splitIntoParagraphs(newContent);
    const changedIndices = changes.map(change => change.index);
    
    // If too many changes, fall back to full document analysis
    // 🎯 PERFORMANCE OPTIMIZATION: Be more aggressive about context windows
    const changeThreshold = Math.max(4, Math.floor(newParagraphs.length * 0.7)); // Increased threshold
    const isFullDocument = changedIndices.length > changeThreshold || newParagraphs.length < 3;
    
    if (isFullDocument) {
      // Full document analysis
      const contextWindow: ContextWindow[] = newParagraphs.map((paragraph, index) => ({
        index,
        text: paragraph,
        isChanged: true,
        type: 'changed',
        startIndex: this.calculateParagraphStartIndex(newParagraphs, index),
        endIndex: this.calculateParagraphStartIndex(newParagraphs, index) + paragraph.length
      }));
      
      return {
        contextWindow,
        totalParagraphs: newParagraphs.length,
        changedParagraphCount: newParagraphs.length,
        isFullDocument: true
      };
    }
    
    // Context window analysis
    const contextWindow = this.buildContextWindow(newParagraphs, changedIndices, contextSize);
    const documentSummary = this.generateDocumentSummary(newContent);
    
    return {
      contextWindow,
      documentSummary,
      totalParagraphs: newParagraphs.length,
      changedParagraphCount: changedIndices.length,
      isFullDocument: false
    };
  },

  /**
   * Check if context window analysis should be used
   */
  shouldUseContextWindow(
    oldContent: string,
    newContent: string,
    minParagraphs: number = 3
  ): boolean {
    const newParagraphs = this.splitIntoParagraphs(newContent);
    const changes = this.detectChangedParagraphs(oldContent, newContent);
    
    // Use context window if:
    // 1. Document has enough paragraphs (reduced from 4 to 3)
    // 2. Changes are localized (less than 70% of document - more aggressive)
    // 3. Not a completely new document (reduced threshold)
    const hasEnoughParagraphs = newParagraphs.length >= minParagraphs;
    const changesLocalized = changes.length < Math.floor(newParagraphs.length * 0.7);
    const notNewDocument = oldContent.trim().length > 50; // Reduced from 100 to 50
    
    // 🎯 PERFORMANCE OPTIMIZATION: Be more aggressive about using context windows
    // Even for larger documents, if changes are localized, use context window
    const isLargeDocument = newParagraphs.length > 8;
    const hasSmallChanges = changes.length <= 3;
    
    if (isLargeDocument && hasSmallChanges) {
      return true; // Force context window for large docs with small changes
    }
    
    return hasEnoughParagraphs && changesLocalized && notNewDocument;
  },

  /**
   * Split content into paragraphs
   */
  splitIntoParagraphs(content: string): string[] {
    return content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  },

  /**
   * Find paragraph start index in content
   */
  findParagraphStartIndex(content: string, paragraph: string, startFrom: number = 0): number {
    if (!paragraph) return startFrom;
    
    const index = content.indexOf(paragraph, startFrom);
    return index >= 0 ? index : startFrom;
  },

  /**
   * Calculate paragraph start index based on previous paragraphs
   */
  calculateParagraphStartIndex(paragraphs: string[], targetIndex: number): number {
    let index = 0;
    for (let i = 0; i < targetIndex; i++) {
      if (paragraphs[i]) {
        index += paragraphs[i].length + 2; // +2 for paragraph separator
      }
    }
    return index;
  },

  /**
   * Generate content hash for caching
   */
  generateContentHash(contextWindow: ContextWindow[], writingGoals?: any): string {
    const contentToHash = {
      contextWindow: contextWindow.map(w => ({ text: w.text, isChanged: w.isChanged })),
      writingGoals
    };
    
    return simpleHash(JSON.stringify(contentToHash)).substring(0, 16); // Use first 16 characters for shorter hash
  },

  /**
   * Calculate token savings estimate
   */
  estimateTokenSavings(
    originalContent: string,
    contextWindow: ContextWindow[]
  ): { originalTokens: number; optimizedTokens: number; savings: number } {
    // Rough token estimation (1 token ≈ 4 characters)
    const originalTokens = Math.ceil(originalContent.length / 4);
    const contextText = contextWindow.map(w => w.text).join(' ');
    const optimizedTokens = Math.ceil(contextText.length / 4);
    const savings = Math.max(0, ((originalTokens - optimizedTokens) / originalTokens) * 100);
    
    return {
      originalTokens,
      optimizedTokens,
      savings: Math.round(savings)
    };
  }
}; 