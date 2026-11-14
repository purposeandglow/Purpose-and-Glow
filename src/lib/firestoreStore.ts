import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  db,
  ADMIN_EMAIL,
  isVerifiedAdminUser,
  OperationType,
  handleFirestoreError,
} from './firebase.ts';
import type { IntentClusterId, KeywordRule, LeadSignal, ServicePackage } from '../data/purposeGlowData.ts';

const ALLOWED_INTENT_CLUSTERS: IntentClusterId[] = [
  'active_resume_friction',
  'transferable_pivot',
  'healthcare_rcm_authority',
  'interview_urgency',
  'negative_noise',
];

const ALLOWED_PACKAGE_IDS: ServicePackage['id'][] = [
  'diy_free',
  'student_50',
  'revamp_99',
  'scratch_145',
];

export const ALLOWED_LEAD_STATUSES = [
  'new_lead',
  'new_signal',
  'qualified',
  'contacted',
  'diagnostic_sent',
  'outreach_sent',
  'interested',
  'diy_review_offered',
  'follow_up_needed',
  'client',
  'booked_client',
  'converted',
  'completed',
  'not_interested',
  'closed',
  'archived',
  'filtered_noise',
] as const;

export const ALLOWED_CLUSTERS = [
  'healthcare_rcm',
  'career_pivot',
  'layoff_urgent',
  'student_grad',
  'general',
] as const;

export function sanitizeFirestoreId(rawId: string, fallbackPrefix = 'rec'): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  if (cleaned.length > 0 && /^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now()}`;
}

export function clampString(value: unknown, maxLength: number, fallback = ''): string {
  const str = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  const normalized = str || fallback;
  return normalized.slice(0, maxLength);
}

export function clampScore(value: unknown, fallback = 50): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function buildFirestoreLeadPayload(
  lead: Partial<LeadSignal> & { id: string; fitScore?: number; notes?: string },
  user: Pick<User, 'uid' | 'email'>,
  isUpdate = false
) {
  const id = sanitizeFirestoreId(lead.id, 'lead');
  const status = ALLOWED_LEAD_STATUSES.includes(lead.status as any)
    ? (lead.status as string)
    : 'new_signal';
  const detectedCluster = ALLOWED_CLUSTERS.includes(lead.detectedCluster as any)
    ? (lead.detectedCluster as string)
    : 'general';

  const noteParts: string[] = [];
  if (lead.notes) noteParts.push(lead.notes);
  else {
    if (lead.diagnosticBottleNeck) noteParts.push(`Bottleneck: ${lead.diagnosticBottleNeck}`);
    if (lead.dutyVsContributionGap) noteParts.push(`Gap: ${lead.dutyVsContributionGap}`);
    if (lead.diagnosticQuestionToAsk) noteParts.push(`Question: ${lead.diagnosticQuestionToAsk}`);
  }
  const combinedNotes = clampString(noteParts.join(' | '), 4000);

  const payload: Record<string, any> = {
    id,
    ownerUid: sanitizeFirestoreId(user.uid, 'uid'),
    ownerEmail: clampString(user.email || ADMIN_EMAIL, 254).toLowerCase(),
    personName: clampString(lead.personName, 120, 'Candidate'),
    headline: clampString(lead.headline, 240, 'Job Seeker'),
    location: clampString(lead.location, 120, 'United States / Remote'),
    sourceType: clampString(lead.sourceType, 80, 'Public LinkedIn Post'),
    rawText: clampString(lead.rawText, 12000, 'Lead inquiry captured from Admin Workbench'),
    detectedCluster,
    status,
    recommendedPackageId: clampString(lead.recommendedPackageId, 64, 'revamp_99'),
    fitScore: clampScore(lead.fitScore, 60),
    updatedAt: serverTimestamp(),
  };

  if (lead.sourceContext) {
    payload.sourceContext = clampString(lead.sourceContext, 240);
  }
  if (lead.sourceUrl) {
    payload.sourceUrl = clampString(lead.sourceUrl, 500);
  }
  if (combinedNotes) {
    payload.notes = combinedNotes;
  }
  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
  }

  return payload;
}

export function buildFirestoreKeywordRulePayload(
  rule: KeywordRule,
  user: Pick<User, 'uid' | 'email'>,
  isUpdate = false
) {
  const id = sanitizeFirestoreId(rule.id, 'rule');
  const weightNum = Number.isFinite(Number(rule.weight))
    ? Math.max(-100, Math.min(100, Number(rule.weight)))
    : 10;

  const payload: Record<string, any> = {
    id,
    ownerUid: sanitizeFirestoreId(user.uid, 'uid'),
    ownerEmail: clampString(user.email || ADMIN_EMAIL, 254).toLowerCase(),
    phrase: clampString(rule.phrase, 120, 'resume'),
    weight: weightNum,
    category: clampString(rule.clusterLabel || rule.cluster, 60, 'active_resume_friction'),
    rationale: clampString(rule.rationale, 500),
    enabled: Boolean(rule.enabled),
    updatedAt: serverTimestamp(),
  };

  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
  }

  return payload;
}

export function buildFirestoreChatMessagePayload(
  msg: { id: string; role: 'user' | 'model'; content: string; relatedLeadId?: string | null },
  user: Pick<User, 'uid' | 'email'>
) {
  const id = sanitizeFirestoreId(msg.id, 'chat');
  const payload: Record<string, any> = {
    id,
    ownerUid: sanitizeFirestoreId(user.uid, 'uid'),
    ownerEmail: clampString(user.email || ADMIN_EMAIL, 254).toLowerCase(),
    role: msg.role === 'model' ? 'model' : 'user',
    content: clampString(msg.content, 12000, '...'),
    createdAt: serverTimestamp(),
  };

  if (msg.relatedLeadId) {
    payload.relatedLeadId = sanitizeFirestoreId(msg.relatedLeadId, 'lead');
  }

  return payload;
}

export async function saveLeadToFirestore(
  lead: Partial<LeadSignal> & { id: string; fitScore?: number; notes?: string },
  user: User | null
): Promise<{ saved: boolean; error?: string }> {
  if (!isVerifiedAdminUser(user) || !user) {
    return { saved: false, error: 'Verified admin authentication required' };
  }

  const docId = sanitizeFirestoreId(lead.id, 'lead');
  const docPath = `leads/${docId}`;
  const docRef = doc(db, 'leads', docId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const updatePayload = buildFirestoreLeadPayload(lead, user, true);
      delete updatePayload.id;
      delete updatePayload.ownerUid;
      delete updatePayload.ownerEmail;
      delete updatePayload.createdAt;
      await updateDoc(docRef, updatePayload);
    } else {
      const createPayload = buildFirestoreLeadPayload(lead, user, false);
      await setDoc(docRef, createPayload);
    }
    return { saved: true };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    } catch (formattedErr: any) {
      return { saved: false, error: formattedErr?.message || 'Firestore write failed' };
    }
  }
}

function formatFirestoreTimestamp(value: any): string {
  try {
    if (value && typeof value.toDate === 'function') {
      return value.toDate().toLocaleString();
    }
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  } catch {}
  return 'Synced from Cloud';
}

export function hydrateLeadFromFirestore(rawDoc: Record<string, any>): LeadSignal {
  const personName = clampString(rawDoc.personName, 120, 'Candidate');
  const status = ALLOWED_LEAD_STATUSES.includes(rawDoc.status)
    ? (rawDoc.status as LeadSignal['status'])
    : 'new_signal';
  const detectedCluster = ALLOWED_CLUSTERS.includes(rawDoc.detectedCluster)
    ? (rawDoc.detectedCluster as LeadSignal['detectedCluster'])
    : 'general';
  const recommendedPackageId = ALLOWED_PACKAGE_IDS.includes(rawDoc.recommendedPackageId)
    ? (rawDoc.recommendedPackageId as ServicePackage['id'])
    : 'revamp_99';

  const notes = typeof rawDoc.notes === 'string' ? rawDoc.notes : '';
  const bottleneckMatch = notes.match(/Bottleneck:\s*([^|]+)/i);
  const gapMatch = notes.match(/Gap:\s*([^|]+)/i);
  const questionMatch = notes.match(/Question:\s*([^|]+)/i);

  return {
    id: String(rawDoc.id || ''),
    personName,
    headline: clampString(rawDoc.headline, 240, 'Job Seeker'),
    location: clampString(rawDoc.location, 120, 'United States / Remote'),
    sourceType: clampString(rawDoc.sourceType, 80, 'Public LinkedIn Post') as LeadSignal['sourceType'],
    sourceContext: clampString(rawDoc.sourceContext, 240, 'Synced from Purpose & Glow Cloud'),
    sourceUrl: typeof rawDoc.sourceUrl === 'string' && rawDoc.sourceUrl.trim() ? rawDoc.sourceUrl.trim() : undefined,
    isRealTimeLive: true,
    verificationStatus: 'user_ingested',
    timestamp: formatFirestoreTimestamp(rawDoc.updatedAt || rawDoc.createdAt),
    rawText: clampString(rawDoc.rawText, 12000, 'Synced lead record'),
    yearsExperience: typeof rawDoc.yearsExperience === 'number' ? rawDoc.yearsExperience : 5,
    isHealthcareOrOps:
      typeof rawDoc.isHealthcareOrOps === 'boolean'
        ? rawDoc.isHealthcareOrOps
        : detectedCluster === 'healthcare_rcm',
    hasExistingResume:
      typeof rawDoc.hasExistingResume === 'boolean'
        ? rawDoc.hasExistingResume
        : recommendedPackageId !== 'scratch_145',
    status,
    detectedCluster,
    recommendedPackageId,
    diagnosticBottleNeck:
      bottleneckMatch?.[1]?.trim() ||
      clampString(notes, 300) ||
      'Awaiting diagnostic positioning review.',
    dutyVsContributionGap:
      gapMatch?.[1]?.trim() ||
      'Translate day-to-day duties into measurable contributions and operational impact.',
    diagnosticQuestionToAsk:
      questionMatch?.[1]?.trim() ||
      'What target roles or organizations are at the top of your job search list right now?',
    publicCommentDraft:
      typeof rawDoc.publicCommentDraft === 'string' && rawDoc.publicCommentDraft.trim()
        ? rawDoc.publicCommentDraft
        : `Hi ${personName}, your experience has real value—let's make sure your résumé communicates measurable impact rather than just daily duties.`,
    warmDmDraft:
      typeof rawDoc.warmDmDraft === 'string' && rawDoc.warmDmDraft.trim()
        ? rawDoc.warmDmDraft
        : `Hi ${personName}, I noticed your update and would be glad to share a quick diagnostic perspective on positioning your background.`,
  };
}

export function hydrateKeywordRuleFromFirestore(rawDoc: Record<string, any>): KeywordRule {
  const cluster = ALLOWED_INTENT_CLUSTERS.includes(rawDoc.cluster)
    ? (rawDoc.cluster as IntentClusterId)
    : 'active_resume_friction';
  const rawWeight = Number(rawDoc.weight);
  const weight = Number.isFinite(rawWeight) ? Math.max(-100, Math.min(100, rawWeight)) : 10;

  return {
    id: String(rawDoc.id || ''),
    phrase: clampString(rawDoc.phrase, 120, 'resume'),
    cluster,
    clusterLabel: clampString(rawDoc.category || rawDoc.clusterLabel, 60, 'Active Résumé & ATS Friction'),
    weight,
    rationale: clampString(rawDoc.rationale, 500, 'Cloud-synced qualification rule.'),
    enabled: typeof rawDoc.enabled === 'boolean' ? rawDoc.enabled : true,
  };
}

/**
 * Non-destructive merge: preserves all existing local browser records untouched.
 * If Firestore is empty (`[]`), returns `localItems` verbatim so cloud sync can never wipe local data.
 */
export function mergeLocalAndCloudRecords<T extends { id: string }>(
  localItems: T[],
  cloudItems: T[]
): T[] {
  if (!Array.isArray(cloudItems) || cloudItems.length === 0) {
    return localItems;
  }
  const existingIds = new Set(localItems.map((item) => item.id));
  const additions = cloudItems.filter((item) => item && item.id && !existingIds.has(item.id));
  if (additions.length === 0) {
    return localItems;
  }
  return [...localItems, ...additions];
}

export async function fetchAdminLeadsFromFirestore(
  user: User | null
): Promise<{ leads: LeadSignal[]; empty?: boolean; permissionDenied?: boolean; error?: string }> {
  if (!isVerifiedAdminUser(user) || !user?.email) {
    return { leads: [], error: 'Verified admin authentication required' };
  }

  try {
    const q = query(
      collection(db, 'leads'),
      where('ownerEmail', '==', user.email.toLowerCase())
    );
    const snap = await getDocs(q);
    const hydrated = snap.docs.map((d) => hydrateLeadFromFirestore({ ...d.data(), id: d.id }));
    return {
      leads: hydrated,
      empty: hydrated.length === 0,
    };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'leads');
    } catch (formattedErr: any) {
      const msg = formattedErr?.message || 'Firestore list failed';
      return {
        leads: [],
        permissionDenied: msg.toLowerCase().includes('permission'),
        error: msg,
      };
    }
  }
}

export async function fetchAdminKeywordRulesFromFirestore(
  user: User | null
): Promise<{ rules: KeywordRule[]; empty?: boolean; permissionDenied?: boolean; error?: string }> {
  if (!isVerifiedAdminUser(user) || !user?.email) {
    return { rules: [], error: 'Verified admin authentication required' };
  }

  try {
    const q = query(
      collection(db, 'keywordRules'),
      where('ownerEmail', '==', user.email.toLowerCase())
    );
    const snap = await getDocs(q);
    const hydrated = snap.docs.map((d) => hydrateKeywordRuleFromFirestore({ ...d.data(), id: d.id }));
    return {
      rules: hydrated,
      empty: hydrated.length === 0,
    };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'keywordRules');
    } catch (formattedErr: any) {
      const msg = formattedErr?.message || 'Firestore list failed';
      return {
        rules: [],
        permissionDenied: msg.toLowerCase().includes('permission'),
        error: msg,
      };
    }
  }
}

export async function syncAdminRecordsToFirestore(
  params: {
    leads: (LeadSignal & { fitScore?: number })[];
    keywordRules: KeywordRule[];
  },
  user: User | null
): Promise<{
  leadsSynced: number;
  rulesSynced: number;
  errors: string[];
}> {
  if (!isVerifiedAdminUser(user) || !user) {
    return {
      leadsSynced: 0,
      rulesSynced: 0,
      errors: ['Verified admin authentication required before syncing to Firestore.'],
    };
  }

  let leadsSynced = 0;
  let rulesSynced = 0;
  const errors: string[] = [];

  for (const lead of params.leads) {
    const res = await saveLeadToFirestore(lead, user);
    if (res.saved) {
      leadsSynced += 1;
    } else if (res.error && errors.length < 3) {
      errors.push(res.error);
    }
  }

  for (const rule of params.keywordRules) {
    const ruleId = sanitizeFirestoreId(rule.id, 'rule');
    const ruleRef = doc(db, 'keywordRules', ruleId);
    try {
      const existingSnap = await getDoc(ruleRef);
      if (existingSnap.exists()) {
        const updatePayload = buildFirestoreKeywordRulePayload(rule, user, true);
        delete updatePayload.id;
        delete updatePayload.ownerUid;
        delete updatePayload.ownerEmail;
        delete updatePayload.createdAt;
        await updateDoc(ruleRef, updatePayload);
      } else {
        await setDoc(ruleRef, buildFirestoreKeywordRulePayload(rule, user, false));
      }
      rulesSynced += 1;
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, `keywordRules/${ruleId}`);
      } catch (formattedErr: any) {
        if (errors.length < 3) {
          errors.push(formattedErr?.message || 'Rule sync failed');
        }
      }
    }
  }

  return { leadsSynced, rulesSynced, errors };
}
