export type ServiceInterestKey =
  | 'student_50'
  | 'revamp_99'
  | 'scratch_145'
  | 'cover_letter_49'
  | 'tailoring_45'
  | 'interview_65'
  | 'tally_registration'
  | 'human_review';

export interface AssessmentEventSummary {
  id: string;
  timestamp: string;
  type:
    | 'requested'
    | 'completed'
    | 'failed'
    | 'rate_limited'
    | 'blocked_disabled'
    | 'tally_conversion'
    | 'service_interest';
  detail: string;
  targetRoleCategory?: string;
  serviceKey?: ServiceInterestKey;
}

export interface AssessmentActivitySnapshot {
  requested: number;
  completed: number;
  failed: number;
  rateLimited: number;
  blockedWhileDisabled: number;
  tallyConversions: number;
  humanReviewSelections: number;
  serviceInterestCounts: Record<
    'student_50' | 'revamp_99' | 'scratch_145' | 'cover_letter_49' | 'tailoring_45' | 'interview_65',
    number
  >;
  recentEvents: AssessmentEventSummary[];
}

/**
 * Aggregate-only telemetry tracker for Admin Workbench.
 * Stores NO visitor names, emails, IP addresses, or raw résumé contents.
 */
export class AssessmentTelemetryTracker {
  private snapshot: AssessmentActivitySnapshot = {
    requested: 0,
    completed: 0,
    failed: 0,
    rateLimited: 0,
    blockedWhileDisabled: 0,
    tallyConversions: 0,
    humanReviewSelections: 0,
    serviceInterestCounts: {
      student_50: 0,
      revamp_99: 0,
      scratch_145: 0,
      cover_letter_49: 0,
      tailoring_45: 0,
      interview_65: 0,
    },
    recentEvents: [],
  };

  private pushEvent(event: Omit<AssessmentEventSummary, 'id' | 'timestamp'>) {
    this.snapshot.recentEvents.unshift({
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    });
    if (this.snapshot.recentEvents.length > 50) {
      this.snapshot.recentEvents.length = 50;
    }
  }

  recordRequested(targetRoleCategory?: string) {
    this.snapshot.requested += 1;
    this.pushEvent({
      type: 'requested',
      detail: 'AI résumé assessment requested',
      targetRoleCategory: targetRoleCategory?.slice(0, 80),
    });
  }

  recordCompleted(targetRoleCategory?: string) {
    this.snapshot.completed += 1;
    this.pushEvent({
      type: 'completed',
      detail: 'AI résumé assessment completed',
      targetRoleCategory: targetRoleCategory?.slice(0, 80),
    });
  }

  recordFailed(reason: string) {
    this.snapshot.failed += 1;
    this.pushEvent({
      type: 'failed',
      detail: String(reason || 'Assessment error').slice(0, 140),
    });
  }

  recordRateLimited(scope: string) {
    this.snapshot.rateLimited += 1;
    this.pushEvent({
      type: 'rate_limited',
      detail: `Rate limit or circuit breaker triggered (${scope})`.slice(0, 140),
    });
  }

  recordBlockedDisabled() {
    this.snapshot.blockedWhileDisabled += 1;
    this.pushEvent({
      type: 'blocked_disabled',
      detail: 'Public request blocked while PUBLIC_AI_ENABLED=false',
    });
  }

  recordConversionOrInterest(key: ServiceInterestKey) {
    if (key === 'tally_registration') {
      this.snapshot.tallyConversions += 1;
      this.pushEvent({
        type: 'tally_conversion',
        detail: 'Visitor clicked Free Tally Registration (https://tally.so/r/q5a1RY)',
        serviceKey: key,
      });
      return;
    }

    if (key === 'human_review') {
      this.snapshot.humanReviewSelections += 1;
      this.pushEvent({
        type: 'service_interest',
        detail: 'Visitor chose complimentary human review instead of AI',
        serviceKey: key,
      });
      return;
    }

    if (key in this.snapshot.serviceInterestCounts) {
      this.snapshot.serviceInterestCounts[
        key as keyof AssessmentActivitySnapshot['serviceInterestCounts']
      ] += 1;
      this.pushEvent({
        type: 'service_interest',
        detail: `Visitor explored optional service (${key})`,
        serviceKey: key,
      });
    }
  }

  getSnapshot(): AssessmentActivitySnapshot {
    return {
      ...this.snapshot,
      serviceInterestCounts: { ...this.snapshot.serviceInterestCounts },
      recentEvents: [...this.snapshot.recentEvents],
    };
  }
}
