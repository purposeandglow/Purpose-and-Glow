import type { StructuredResumeAssessment } from './assessmentConstants.ts';

/**
 * Formats a completed 8-section résumé assessment into clean plain text
 * for the visitor's own personal notes. Runs locally in the browser and stores
 * zero personal information.
 */
export function formatAssessmentForClipboard(
  assessment: StructuredResumeAssessment,
  targetJobTitle?: string
): string {
  const lines: string[] = [
    'PURPOSE & GLOW CAREER SOLUTIONS — COMPLIMENTARY RÉSUMÉ ASSESSMENT',
    targetJobTitle ? `Target Role: ${targetJobTitle.trim()}` : 'Target Role: Specified Career Direction',
    '',
    '1. OVERALL EVALUATION',
    assessment.overallEvaluation,
    '',
    '2. ATS COMPATIBILITY RECOMMENDATIONS',
    ...assessment.atsCompatibilityRecommendations.map((item) => `• ${item}`),
    '',
    '3. READY-TO-ADAPT PROFESSIONAL SUMMARY',
    ...(assessment.readyToAdaptSummary
      ? [
          assessment.readyToAdaptSummary,
          ...(assessment.summaryCoachingNote ? [`Coaching Note: ${assessment.summaryCoachingNote}`] : [])
        ]
      : assessment.professionalSummarySuggestions.map((item) => `• ${item}`)),
    '',
    '4. WORK EXPERIENCE & ACHIEVEMENT FRAMING',
    ...assessment.workExperienceRecommendations.map((item) => `• ${item}`),
    '',
    '5. SKILLS & KEYWORD ALIGNMENT',
    ...assessment.skillsAndKeywordRecommendations.map((item) => `• ${item}`),
    '',
    '6. FORMATTING & READABILITY',
    ...assessment.formattingAndReadabilitySuggestions.map((item) => `• ${item}`),
    '',
    '7. PRACTICAL JOB-SEARCH NEXT STEPS',
    ...assessment.practicalJobSearchRecommendations.map((item) => `• ${item}`),
  ];

  if (assessment.beforeAfterExamples.length > 0) {
    lines.push('', '8. GROUNDED BEFORE & AFTER BULLET EXAMPLES');
    assessment.beforeAfterExamples.forEach((ex, index) => {
      lines.push(
        `Example ${index + 1}:`,
        `  From your résumé: ${ex.originalContext}`,
        `  Stronger option:  ${ex.improvedExample}`,
        ...(ex.whyItWorks ? [`  Why it works:     ${ex.whyItWorks}`] : [])
      );
    });
  }

  lines.push(
    '',
    'OPTIONAL NEXT-STEP SUPPORT',
    assessment.suggestedServiceFocus,
    '',
    'IMPORTANT NOTICE',
    assessment.disclaimer
  );

  return lines.join('\n');
}
