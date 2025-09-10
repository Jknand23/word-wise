import type { Suggestion } from '../types/suggestion';
import type { AcademicLevel } from '../store/writingGoalsStore';

export interface GradeLevelPriorities {
  emphasize: string[];
  deemphasize: string[];
  severityAdjustment: {
    [key: string]: 'high' | 'medium' | 'low';
  };
}

/**
 * Grade-level specific filtering and prioritization of AI suggestions
 * Based on developmental writing needs at each academic level
 */
export class GradeLevelSuggestionFilter {
  private static gradeLevelPriorities: Record<AcademicLevel, GradeLevelPriorities> = {
    'middle-school': {
      emphasize: ['grammar', 'spelling', 'clarity', 'structure'],
      deemphasize: ['tone', 'depth', 'vocabulary'],
      severityAdjustment: {
        // Basic grammar and spelling are high priority
        'grammar': 'high',
        'spelling': 'high',
        // Clarity and simple structure are important
        'clarity': 'high',
        'structure': 'medium',
        // Advanced concepts are lower priority
        'tone': 'low',
        'depth': 'low',
        'vocabulary': 'medium',
        'engagement': 'medium'
      }
    },
    'high-school': {
      emphasize: ['grammar', 'clarity', 'structure', 'tone', 'engagement'],
      deemphasize: ['depth'],
      severityAdjustment: {
        // Grammar still important but more nuanced
        'grammar': 'high',
        'spelling': 'high',
        // Thesis clarity and argument structure become crucial
        'clarity': 'high',
        'structure': 'high',
        // Tone and formality for academic writing
        'tone': 'high',
        'engagement': 'high',
        // Advanced depth less critical
        'depth': 'medium',
        'vocabulary': 'medium'
      }
    },
    'undergrad': {
      emphasize: ['depth', 'tone', 'vocabulary', 'structure', 'clarity'],
      deemphasize: ['spelling'],
      severityAdjustment: {
        // Advanced critical thinking and argumentation
        'depth': 'high',
        'tone': 'high',
        'vocabulary': 'high',
        // Complex sentence structures and coherence
        'structure': 'high',
        'clarity': 'high',
        // Basic errors less prominent (assumed competency)
        'grammar': 'medium',
        'spelling': 'medium',
        'engagement': 'medium'
      }
    }
  };

  /**
   * Filter suggestions based on academic level priorities
   */
  static filterSuggestions(
    suggestions: Suggestion[],
    academicLevel: AcademicLevel
  ): Suggestion[] {
    const priorities = this.gradeLevelPriorities[academicLevel];
    
    return suggestions
      .map(suggestion => this.adjustSuggestionForLevel(suggestion, academicLevel, priorities))
      .filter(suggestion => this.shouldIncludeSuggestion(suggestion, academicLevel))
      .sort((a, b) => this.compareSuggestionPriority(a, b, academicLevel));
  }

  /**
   * Adjust suggestion properties based on academic level
   */
  private static adjustSuggestionForLevel(
    suggestion: Suggestion,
    academicLevel: AcademicLevel,
    priorities: GradeLevelPriorities
  ): Suggestion {
    const adjustedSuggestion = { ...suggestion };
    
    // Adjust severity based on grade level priorities
    if (priorities.severityAdjustment[suggestion.type]) {
      adjustedSuggestion.severity = priorities.severityAdjustment[suggestion.type];
    }

    // Adjust explanations for grade level appropriateness
    adjustedSuggestion.explanation = this.adaptExplanationForLevel(
      suggestion.explanation,
      suggestion.type,
      academicLevel
    );

    return adjustedSuggestion;
  }

  /**
   * Determine if a suggestion should be included based on academic level
   */
  private static shouldIncludeSuggestion(
    suggestion: Suggestion,
    academicLevel: AcademicLevel
  ): boolean {
    // Always include high-severity suggestions
    if (suggestion.severity === 'high') {
      return true;
    }

    // For middle school, focus on fundamental skills
    if (academicLevel === 'middle-school') {
      return this.shouldIncludeForMiddleSchool(suggestion);
    }

    // For high school, balance fundamentals with advanced skills
    if (academicLevel === 'high-school') {
      return this.shouldIncludeForHighSchool(suggestion);
    }

    // For undergrad, focus on advanced writing skills
    if (academicLevel === 'undergrad') {
      return this.shouldIncludeForUndergrad(suggestion);
    }

    return true;
  }

  /**
   * Middle School filtering: Focus on basic skills
   */
  private static shouldIncludeForMiddleSchool(suggestion: Suggestion): boolean {
    // Emphasize basic grammar and spelling
    if (['grammar', 'spelling'].includes(suggestion.type)) {
      return true;
    }

    // Include clarity suggestions for simple sentence structure
    if (suggestion.type === 'clarity') {
      return this.isSimpleClarityIssue(suggestion);
    }

    // Include basic structure suggestions (paragraph organization)
    if (suggestion.type === 'structure') {
      return this.isBasicStructureIssue(suggestion);
    }

    // Include vocabulary suggestions for more specific word choices
    if (suggestion.type === 'vocabulary') {
      return this.isSimpleVocabularyImprovement(suggestion);
    }

    // Limit advanced suggestions
    if (['tone', 'depth'].includes(suggestion.type)) {
      return suggestion.severity === 'high';
    }

    return suggestion.severity !== 'low';
  }

  /**
   * High School filtering: Balance fundamentals with advanced skills
   */
  private static shouldIncludeForHighSchool(suggestion: Suggestion): boolean {
    // Support thesis clarity and argument structure
    if (suggestion.type === 'structure') {
      return this.isArgumentStructureIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Suggest smoother transitions and sentence variety
    if (suggestion.type === 'clarity') {
      return this.isTransitionOrVarietyIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Improve tone and formality for academic writing
    if (suggestion.type === 'tone') {
      return this.isAcademicToneIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Help integrate evidence and avoid vague phrasing
    if (suggestion.type === 'engagement') {
      return this.isEvidenceOrVaguenessIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Still include grammar and spelling but with less emphasis
    if (['grammar', 'spelling'].includes(suggestion.type)) {
      return true;
    }

    // Limit depth suggestions to higher severity
    if (suggestion.type === 'depth') {
      return suggestion.severity === 'high';
    }

    return suggestion.severity !== 'low';
  }

  /**
   * Undergraduate filtering: Focus on advanced writing skills
   */
  private static shouldIncludeForUndergrad(suggestion: Suggestion): boolean {
    // Push for depth in argument and critical thinking
    if (suggestion.type === 'depth') {
      return true;
    }

    // Ensure advanced clarity in complex sentence structures
    if (suggestion.type === 'clarity') {
      return this.isComplexClarityIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Recommend precise academic language
    if (suggestion.type === 'vocabulary') {
      return this.isAcademicVocabularyIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Focus on global coherence and discipline-specific tone
    if (suggestion.type === 'tone') {
      return this.isDisciplineSpecificToneIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Advanced structure and coherence
    if (suggestion.type === 'structure') {
      return this.isGlobalCoherenceIssue(suggestion) || suggestion.severity !== 'low';
    }

    // Basic grammar and spelling are less emphasized but still included
    if (['grammar', 'spelling'].includes(suggestion.type)) {
      return suggestion.severity !== 'low';
    }

    return suggestion.severity === 'high';
  }

  /**
   * Compare suggestions for priority ordering
   */
  private static compareSuggestionPriority(
    a: Suggestion,
    b: Suggestion,
    academicLevel: AcademicLevel
  ): number {
    const priorities = this.gradeLevelPriorities[academicLevel];
    
    // Sort by emphasis level first
    const aEmphasis = priorities.emphasize.indexOf(a.type);
    const bEmphasis = priorities.emphasize.indexOf(b.type);
    
    if (aEmphasis !== -1 && bEmphasis !== -1) {
      return aEmphasis - bEmphasis;
    }
    if (aEmphasis !== -1) return -1;
    if (bEmphasis !== -1) return 1;
    
    // Then by severity
    const severityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    // Finally by confidence
    return b.confidence - a.confidence;
  }

  /**
   * Adapt explanation text for academic level
   */
  private static adaptExplanationForLevel(
    explanation: string,
    type: string,
    academicLevel: AcademicLevel
  ): string {
    if (academicLevel === 'middle-school') {
      return this.simplifyExplanation(explanation);
    } else if (academicLevel === 'undergrad') {
      return this.enhanceExplanation(explanation, type);
    }
    return explanation;
  }

  /**
   * Simplify explanations for middle school
   */
  private static simplifyExplanation(explanation: string): string {
    // Replace complex terminology with simpler alternatives
    const simplifications: Record<string, string> = {
      'subject-verb agreement': 'making sure the subject and verb match',
      'possessive apostrophe': 'apostrophe to show ownership',
      'comma splice': 'connecting two sentences with just a comma',
      'passive voice': 'when the subject receives the action',
      'subordinate clause': 'a group of words that depends on the main sentence'
    };

    let simplified = explanation;
    Object.entries(simplifications).forEach(([complex, simple]) => {
      simplified = simplified.replace(new RegExp(complex, 'gi'), simple);
    });

    return simplified;
  }

  /**
   * Enhance explanations for undergraduate level
   */
  private static enhanceExplanation(explanation: string, type: string): string {
    // Add more sophisticated terminology and context
    if (type === 'tone') {
      return explanation + ' Consider the academic discourse conventions of your field.';
    } else if (type === 'depth') {
      return explanation + ' Develop this argument with more nuanced analysis and evidence.';
    } else if (type === 'vocabulary') {
      return explanation + ' Use more precise disciplinary terminology where appropriate.';
    }
    return explanation;
  }

  // Helper methods for specific suggestion type checks
  private static isSimpleClarityIssue(suggestion: Suggestion): boolean {
    const simplePatterns = [
      /sentence structure/i,
      /run-on/i,
      /fragment/i,
      /comma/i,
      /period/i
    ];
    return simplePatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isBasicStructureIssue(suggestion: Suggestion): boolean {
    const basicPatterns = [
      /paragraph/i,
      /topic sentence/i,
      /organization/i,
      /beginning/i,
      /middle/i,
      /end/i
    ];
    return basicPatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isSimpleVocabularyImprovement(suggestion: Suggestion): boolean {
    const simplePatterns = [
      /more specific/i,
      /clearer word/i,
      /better choice/i,
      /replace.*with/i
    ];
    return simplePatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isArgumentStructureIssue(suggestion: Suggestion): boolean {
    const argumentPatterns = [
      /thesis/i,
      /argument/i,
      /evidence/i,
      /support/i,
      /reasoning/i
    ];
    return argumentPatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isTransitionOrVarietyIssue(suggestion: Suggestion): boolean {
    const transitionPatterns = [
      /transition/i,
      /sentence variety/i,
      /flow/i,
      /connection/i,
      /smooth/i
    ];
    return transitionPatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isAcademicToneIssue(suggestion: Suggestion): boolean {
    const tonePatterns = [
      /formal/i,
      /academic/i,
      /professional/i,
      /tone/i,
      /appropriate/i
    ];
    return tonePatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isEvidenceOrVaguenessIssue(suggestion: Suggestion): boolean {
    const evidencePatterns = [
      /evidence/i,
      /vague/i,
      /specific/i,
      /support/i,
      /example/i,
      /unclear/i
    ];
    return evidencePatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isComplexClarityIssue(suggestion: Suggestion): boolean {
    const complexPatterns = [
      /complex sentence/i,
      /subordination/i,
      /coordination/i,
      /parallel structure/i,
      /syntax/i
    ];
    return complexPatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isAcademicVocabularyIssue(suggestion: Suggestion): boolean {
    const academicPatterns = [
      /academic/i,
      /discipline/i,
      /terminology/i,
      /precise/i,
      /technical/i
    ];
    return academicPatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isDisciplineSpecificToneIssue(suggestion: Suggestion): boolean {
    const disciplinePatterns = [
      /discipline/i,
      /field/i,
      /scholarly/i,
      /research/i,
      /academic discourse/i
    ];
    return disciplinePatterns.some(pattern => pattern.test(suggestion.explanation));
  }

  private static isGlobalCoherenceIssue(suggestion: Suggestion): boolean {
    const coherencePatterns = [
      /coherence/i,
      /global/i,
      /overall/i,
      /unity/i,
      /organization/i
    ];
    return coherencePatterns.some(pattern => pattern.test(suggestion.explanation));
  }
} 