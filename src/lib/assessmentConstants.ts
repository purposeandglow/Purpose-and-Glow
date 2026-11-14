export const MIN_RESUME_CHARS = 150;
export const MAX_RESUME_CHARS = 12000;
export const MAX_JOB_DESC_CHARS = 4000;
export const MAX_TARGET_TITLE_CHARS = 160;

export interface ResumeBeforeAfterExample {
  originalContext: string;
  improvedExample: string;
  whyItWorks: string;
}

export interface StructuredResumeAssessment {
  overallEvaluation: string;
  atsCompatibilityRecommendations: string[];
  professionalSummarySuggestions: string[];
  readyToAdaptSummary?: string;
  summaryCoachingNote?: string;
  workExperienceRecommendations: string[];
  skillsAndKeywordRecommendations: string[];
  formattingAndReadabilitySuggestions: string[];
  practicalJobSearchRecommendations: string[];
  beforeAfterExamples: ResumeBeforeAfterExample[];
  suggestedServiceFocus: string;
  disclaimer: string;
  factualWarnings?: string[];
  publicVerificationReminder?: string;
}
