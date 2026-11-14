import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

export type InquiryStatus = 'new' | 'contacted' | 'in_progress' | 'completed' | 'closed';
export type InquiryType = 'contact_form' | 'complimentary_human_review';
export type InquiryUrgency = 'urgent_48h' | 'standard_week' | 'flexible';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'not_configured';

export const INQUIRY_STATUS_OPTIONS: Array<{ value: InquiryStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

export const VALID_INQUIRY_STATUSES = new Set<InquiryStatus>([
  'new',
  'contacted',
  'in_progress',
  'completed',
  'closed',
]);

export const TALLY_INTAKE_URL = 'https://tally.so/r/q5a1RY';
export const DEFAULT_BUSINESS_EMAIL = 'purposeandglowcareers@gmail.com';
export const MAX_INQUIRY_MESSAGE_CHARS = 2000;
export const EXACT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RAPID_BURST_DEDUPE_WINDOW_MS = 60 * 1000; // 60 seconds double-click protection

export interface InboundInquiry {
  id: string;
  ownerEmail: string;
  inquiryType: InquiryType;
  intakeChannel: 'website_contact_form' | 'website_human_review';
  name: string;
  email: string;
  senderEmailNormalized?: string;
  phone?: string;
  service: string;
  currentRole?: string;
  targetRole?: string;
  locationState?: string;
  preferredIndustry?: string;
  urgency: InquiryUrgency;
  message: string;
  resumeIntakeNote?: string;
  recipientEmail: string;
  timestamp: string;
  updatedAt: string;
  isRead: boolean;
  status: InquiryStatus;
  adminNotes?: string;
  dedupeKey: string;
  notificationStatus: NotificationStatus;
  notificationProvider: 'resend' | 'none';
  notificationAttempts: number;
  lastNotificationAttemptAt?: string;
  notificationId?: string;
  notificationError?: string;
}

export interface PublicInquiryReceipt {
  id: string;
  inquiryType: InquiryType;
  service: string;
  recipientEmail: string;
  status: InquiryStatus;
  timestamp: string;
  notificationStatus: NotificationStatus;
  duplicate: boolean;
}

export function normalizeInquiryStatus(raw: unknown): InquiryStatus {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'reviewed') return 'in_progress';
  if (val === 'responded') return 'completed';
  if (VALID_INQUIRY_STATUSES.has(val as InquiryStatus)) {
    return val as InquiryStatus;
  }
  return 'new';
}

export function isValidInquiryStatusInput(raw: unknown): raw is InquiryStatus {
  return typeof raw === 'string' && VALID_INQUIRY_STATUSES.has(raw.trim().toLowerCase() as InquiryStatus);
}

export function isValidEmailAddress(email: string): boolean {
  const cleaned = String(email || '').trim();
  return cleaned.length >= 3 && cleaned.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned);
}

export function clampField(val: unknown, maxLen: number): string {
  return String(val ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeInquiryId(rawId: unknown, prefix: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  return cleaned || `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Detects full multi-section résumés or uploaded résumé payloads so unmasked
 * confidential résumés are never persisted inside Firestore `/inquiries`.
 */
export function hasProhibitedResumePayload(body: Record<string, unknown>): boolean {
  const forbiddenKeys = [
    'resumeText',
    'rawResume',
    'resumeFile',
    'resumeFileBase64',
    'fileBase64',
    'fileContent',
    'fileData',
    'attachment',
    'attachments',
  ];
  for (const key of forbiddenKeys) {
    const val = body[key];
    if (typeof val === 'string' && val.trim().length > 0) return true;
    if (Array.isArray(val) && val.length > 0) return true;
    if (val && typeof val === 'object' && !Array.isArray(val)) return true;
  }
  return false;
}

export function looksLikeFullResumeText(text: string): boolean {
  const normalized = String(text || '').trim();
  if (normalized.length > MAX_INQUIRY_MESSAGE_CHARS) {
    return true;
  }
  if (normalized.length < 900) {
    return false;
  }
  const hasSummary = /\b(?:professional\s+summary|career\s+summary|objective)\b/i.test(normalized);
  const hasExperience = /\b(?:work\s+experience|professional\s+experience|employment\s+history)\b/i.test(
    normalized
  );
  const hasEducation = /\b(?:education|academic\s+background|b\.?s\.?|m\.?s\.?|associate)\b/i.test(normalized);
  const hasSkills = /\b(?:core\s+competencies|technical\s+skills|skills)\b/i.test(normalized);
  const bulletCount = (normalized.match(/(?:^|\n)\s*[-•*]\s+/g) || []).length;

  const sectionHits = [hasSummary, hasExperience, hasEducation, hasSkills].filter(Boolean).length;
  return sectionHits >= 3 || (sectionHits >= 2 && bulletCount >= 5);
}

export function isTallyOriginRequest(body: Record<string, unknown>): boolean {
  const source = String(body.source || body.intakeSource || body.channel || '').trim().toLowerCase();
  return body.fromTally === true || source === 'tally' || source === 'tally_form';
}

export function computeInquiryDedupeKey(params: {
  email: string;
  inquiryType: InquiryType;
  service: string;
  summaryText: string;
}): string {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedService = params.service.trim().toLowerCase().slice(0, 120);
  const normalizedText = params.summaryText.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
  return crypto
    .createHash('sha256')
    .update(`${normalizedEmail}|${params.inquiryType}|${normalizedService}|${normalizedText}`)
    .digest('hex')
    .slice(0, 32);
}

export function toPublicInquiryReceipt(inquiry: InboundInquiry, duplicate: boolean): PublicInquiryReceipt {
  return {
    id: inquiry.id,
    inquiryType: inquiry.inquiryType,
    service: inquiry.service,
    recipientEmail: inquiry.recipientEmail,
    status: inquiry.status,
    timestamp: inquiry.timestamp,
    notificationStatus: inquiry.notificationStatus,
    duplicate,
  };
}

export function toSafeInquiryLogSummary(inquiry: InboundInquiry, extra?: string): string {
  return `id=${inquiry.id} type=${inquiry.inquiryType} status=${inquiry.status} notify=${inquiry.notificationStatus}${extra ? ` ${extra}` : ''}`;
}

export type InquiryValidationResult =
  | {
      ok: true;
      inquiryType: InquiryType;
      intakeChannel: 'website_contact_form' | 'website_human_review';
      name: string;
      email: string;
      phone?: string;
      service: string;
      currentRole?: string;
      targetRole?: string;
      locationState?: string;
      preferredIndustry?: string;
      urgency: InquiryUrgency;
      message: string;
      resumeIntakeNote?: string;
      dedupeKey: string;
    }
  | {
      ok: false;
      statusCode: number;
      errorCode: string;
      error: string;
      skipAsTallyDuplicate?: boolean;
    };

export function validateContactInquiryInput(body: Record<string, unknown>): InquiryValidationResult {
  if (isTallyOriginRequest(body)) {
    return {
      ok: false,
      statusCode: 200,
      errorCode: 'TALLY_DUPLICATE_PREVENTED',
      error: 'Tally submissions are handled directly in Tally without creating duplicate inquiries.',
      skipAsTallyDuplicate: true,
    };
  }

  if (hasProhibitedResumePayload(body)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'RESUME_STORAGE_PROHIBITED',
      error: `Uploaded résumés are not stored in inquiry records for your privacy. Please summarize your career goals here or submit a résumé file confidentially via Tally (${TALLY_INTAKE_URL}).`,
    };
  }

  const name = clampField(body.name, 120);
  const email = clampField(body.email, 254);
  const rawMessage = String(body.message ?? '').trim();

  if (!name || !email || !rawMessage) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'MISSING_REQUIRED_FIELDS',
      error: 'Name, email, and message are required.',
    };
  }

  if (!isValidEmailAddress(email)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'INVALID_EMAIL',
      error: 'Please enter a valid email address.',
    };
  }

  if (looksLikeFullResumeText(rawMessage)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'RESUME_STORAGE_PROHIBITED',
      error: `For privacy protection, please keep inquiry notes under ${MAX_INQUIRY_MESSAGE_CHARS.toLocaleString()} characters without pasting a full résumé. If a résumé file is needed, submit confidentially via Tally (${TALLY_INTAKE_URL}).`,
    };
  }

  const phone = body.phone ? clampField(body.phone, 40) : undefined;
  const service = clampField(body.service || 'Résumé Revamp ($99)', 160) || 'Résumé Revamp ($99)';
  const currentRole = body.currentRole ? clampField(body.currentRole, 160) : undefined;
  const targetRole = body.targetRole ? clampField(body.targetRole, 160) : undefined;
  const urgencyRaw = String(body.urgency || '').trim();
  const urgency: InquiryUrgency =
    urgencyRaw === 'urgent_48h' || urgencyRaw === 'flexible' ? urgencyRaw : 'standard_week';
  const message = clampField(rawMessage, MAX_INQUIRY_MESSAGE_CHARS);

  return {
    ok: true,
    inquiryType: 'contact_form',
    intakeChannel: 'website_contact_form',
    name,
    email,
    phone: phone || undefined,
    service,
    currentRole: currentRole || undefined,
    targetRole: targetRole || undefined,
    urgency,
    message,
    dedupeKey: computeInquiryDedupeKey({
      email,
      inquiryType: 'contact_form',
      service,
      summaryText: message,
    }),
  };
}

export function validateHumanAssessmentInput(body: Record<string, unknown>): InquiryValidationResult {
  if (isTallyOriginRequest(body)) {
    return {
      ok: false,
      statusCode: 200,
      errorCode: 'TALLY_DUPLICATE_PREVENTED',
      error: 'Tally submissions are handled directly in Tally without creating duplicate inquiries.',
      skipAsTallyDuplicate: true,
    };
  }

  if (hasProhibitedResumePayload(body)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'RESUME_STORAGE_PROHIBITED',
      error: `Full uploaded résumés are not stored in inquiry records for privacy protection. Please summarize your career goals or share your résumé securely through Tally (${TALLY_INTAKE_URL}).`,
    };
  }

  if (body.agreedToTerms === false) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'CONSENT_REQUIRED',
      error: 'Please check the confirmation box to authorize your confidential review.',
    };
  }

  const name = clampField(body.fullName, 120);
  const email = clampField(body.email, 254);

  if (!name || !email) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'MISSING_REQUIRED_FIELDS',
      error: 'Full name and email are required for assessment.',
    };
  }

  if (!isValidEmailAddress(email)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'INVALID_EMAIL',
      error: 'Please enter a valid email address.',
    };
  }

  const rawResumeNotes = String(body.resumeNotes ?? '').trim();
  if (rawResumeNotes && looksLikeFullResumeText(rawResumeNotes)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'RESUME_STORAGE_PROHIBITED',
      error: `For privacy protection, please summarize your career goals (under ${MAX_INQUIRY_MESSAGE_CHARS.toLocaleString()} characters) instead of pasting a full résumé here. If a résumé file is needed, use our confidential Tally form (${TALLY_INTAKE_URL}).`,
    };
  }

  const phone = body.phone ? clampField(body.phone, 40) : undefined;
  const locationState = body.locationState ? clampField(body.locationState, 120) : undefined;
  const educationLevel = body.educationLevel ? clampField(body.educationLevel, 120) : undefined;
  const currentRole = body.currentTitle ? clampField(body.currentTitle, 160) : undefined;
  const yearsExperience = body.yearsExperience ? clampField(body.yearsExperience, 80) : undefined;
  const targetRole = body.targetTitles ? clampField(body.targetTitles, 160) : undefined;
  const preferredIndustry = body.preferredIndustry ? clampField(body.preferredIndustry, 120) : undefined;
  const workStyle = body.workStyle ? clampField(body.workStyle, 60) : undefined;
  const desiredSalary = body.desiredSalary ? clampField(body.desiredSalary, 60) : undefined;
  const linkedInUrl = body.linkedInUrl ? clampField(body.linkedInUrl, 240) : undefined;
  const primaryAssistance = clampField(
    body.primaryAssistance || 'Complimentary Human Résumé Review ($0)',
    140
  );
  const service = `Complimentary Human Review: ${primaryAssistance}`.slice(0, 160);
  const notesSummary = clampField(rawResumeNotes, 1000);

  const structuredSummary = [
    `Complimentary Human Assessment Request`,
    currentRole ? `Current Title: ${currentRole}${yearsExperience ? ` (${yearsExperience})` : ''}` : null,
    targetRole ? `Target Role(s): ${targetRole}` : null,
    preferredIndustry ? `Preferred Industry: ${preferredIndustry}` : null,
    locationState ? `Location: ${locationState}` : null,
    educationLevel ? `Education: ${educationLevel}` : null,
    workStyle || desiredSalary
      ? `Preferences: ${[workStyle, desiredSalary].filter(Boolean).join(' · ')}`
      : null,
    linkedInUrl ? `LinkedIn: ${linkedInUrl}` : null,
    `DIY Tips Requested: ${body.wantsDiyTips ? 'Yes' : 'No'}`,
    notesSummary ? `Goals / Brief Context: ${notesSummary}` : 'Goals / Brief Context: (None provided)',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_INQUIRY_MESSAGE_CHARS);

  return {
    ok: true,
    inquiryType: 'complimentary_human_review',
    intakeChannel: 'website_human_review',
    name,
    email,
    phone: phone || undefined,
    service,
    currentRole: currentRole || undefined,
    targetRole: targetRole || undefined,
    locationState: locationState || undefined,
    preferredIndustry: preferredIndustry || undefined,
    urgency: 'urgent_48h',
    message: structuredSummary,
    resumeIntakeNote: `No full résumé stored in Firestore. Request résumé upload via Tally (${TALLY_INTAKE_URL}) or reply if needed.`,
    dedupeKey: computeInquiryDedupeKey({
      email,
      inquiryType: 'complimentary_human_review',
      service,
      summaryText: `${targetRole || ''}|${notesSummary}`,
    }),
  };
}

export interface InquiryStore {
  getMode(): 'firestore' | 'memory';
  findRecentDuplicate(
    dedupeKey: string,
    emailNormalized: string,
    inquiryType: InquiryType
  ): Promise<InboundInquiry | null>;
  createInquiry(inquiry: InboundInquiry): Promise<InboundInquiry>;
  getInquiryById(id: string): Promise<InboundInquiry | null>;
  listInquiries(limit?: number): Promise<InboundInquiry[]>;
  updateInquiryStatus(
    id: string,
    updates: {
      status?: InquiryStatus;
      isRead?: boolean;
      adminNotes?: string;
    }
  ): Promise<InboundInquiry | null>;
  updateNotificationResult(
    id: string,
    updates: {
      notificationStatus: NotificationStatus;
      notificationProvider: 'resend' | 'none';
      notificationAttempts: number;
      lastNotificationAttemptAt: string;
      notificationId?: string;
      notificationError?: string;
    }
  ): Promise<InboundInquiry | null>;
}

function stripUndefinedFields<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

function toIsoDate(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export function hydrateInquiryRecord(id: string, raw: Record<string, any>): InboundInquiry {
  const inquiryType: InquiryType =
    raw.inquiryType === 'complimentary_human_review' ||
    String(raw.service || '').toLowerCase().includes('assessment:') ||
    String(raw.service || '').toLowerCase().includes('complimentary human review')
      ? 'complimentary_human_review'
      : 'contact_form';

  const timestamp = toIsoDate(raw.timestamp || raw.createdAt);
  const updatedAt = toIsoDate(raw.updatedAt || raw.timestamp || raw.createdAt);

  return {
    id: raw.id || id,
    ownerEmail: String(raw.ownerEmail || raw.recipientEmail || DEFAULT_BUSINESS_EMAIL),
    inquiryType,
    intakeChannel:
      raw.intakeChannel === 'website_human_review' || inquiryType === 'complimentary_human_review'
        ? 'website_human_review'
        : 'website_contact_form',
    name: String(raw.name || raw.senderName || 'Applicant'),
    email: String(raw.email || raw.senderEmail || ''),
    senderEmailNormalized: String(
      raw.senderEmailNormalized || raw.email || raw.senderEmail || ''
    )
      .trim()
      .toLowerCase(),
    phone: raw.phone || raw.senderPhone || undefined,
    service: String(raw.service || 'Consultation Inquiry'),
    currentRole: raw.currentRole || undefined,
    targetRole: raw.targetRole || undefined,
    locationState: raw.locationState || undefined,
    preferredIndustry: raw.preferredIndustry || undefined,
    urgency:
      raw.urgency === 'urgent_48h' || raw.urgency === 'flexible' ? raw.urgency : 'standard_week',
    message: String(raw.message || ''),
    resumeIntakeNote: raw.resumeIntakeNote || undefined,
    recipientEmail: String(raw.recipientEmail || raw.ownerEmail || DEFAULT_BUSINESS_EMAIL),
    timestamp,
    updatedAt,
    isRead: Boolean(raw.isRead),
    status: normalizeInquiryStatus(raw.status),
    adminNotes: raw.adminNotes || undefined,
    dedupeKey: String(raw.dedupeKey || ''),
    notificationStatus:
      raw.notificationStatus === 'sent' ||
      raw.notificationStatus === 'failed' ||
      raw.notificationStatus === 'not_configured' ||
      raw.notificationStatus === 'pending'
        ? raw.notificationStatus
        : 'not_configured',
    notificationProvider: raw.notificationProvider === 'resend' ? 'resend' : 'none',
    notificationAttempts:
      typeof raw.notificationAttempts === 'number' && Number.isFinite(raw.notificationAttempts)
        ? raw.notificationAttempts
        : 0,
    lastNotificationAttemptAt: raw.lastNotificationAttemptAt
      ? toIsoDate(raw.lastNotificationAttemptAt)
      : undefined,
    notificationId: raw.notificationId || undefined,
    notificationError: raw.notificationError || undefined,
  };
}

export class FirestoreInquiryStore implements InquiryStore {
  constructor(
    private readonly db: Firestore,
    private readonly collectionName = 'inquiries'
  ) {}

  getMode(): 'firestore' | 'memory' {
    return 'firestore';
  }

  private toFirestoreDoc(inquiry: InboundInquiry): Record<string, any> {
    const emailNormalized = (inquiry.senderEmailNormalized || inquiry.email).trim().toLowerCase();
    return stripUndefinedFields({
      id: inquiry.id,
      ownerEmail: inquiry.ownerEmail,
      inquiryType: inquiry.inquiryType,
      intakeChannel: inquiry.intakeChannel,
      senderName: inquiry.name,
      senderEmail: inquiry.email,
      senderEmailNormalized: emailNormalized,
      senderPhone: inquiry.phone,
      service: inquiry.service,
      currentRole: inquiry.currentRole,
      targetRole: inquiry.targetRole,
      locationState: inquiry.locationState,
      preferredIndustry: inquiry.preferredIndustry,
      urgency: inquiry.urgency,
      message: inquiry.message,
      resumeIntakeNote: inquiry.resumeIntakeNote,
      recipientEmail: inquiry.recipientEmail,
      timestamp: inquiry.timestamp,
      createdAt: new Date(inquiry.timestamp),
      updatedAt: new Date(inquiry.updatedAt),
      isRead: inquiry.isRead,
      status: inquiry.status,
      adminNotes: inquiry.adminNotes,
      dedupeKey: inquiry.dedupeKey,
      notificationStatus: inquiry.notificationStatus,
      notificationProvider: inquiry.notificationProvider,
      notificationAttempts: inquiry.notificationAttempts,
      lastNotificationAttemptAt: inquiry.lastNotificationAttemptAt,
      notificationId: inquiry.notificationId,
      notificationError: inquiry.notificationError,
    });
  }

  async findRecentDuplicate(
    dedupeKey: string,
    emailNormalized: string,
    inquiryType: InquiryType
  ): Promise<InboundInquiry | null> {
    const nowMs = Date.now();
    const col = this.db.collection(this.collectionName);

    // 1. Exact payload match within 24 hours (uses single-field automatic index)
    const exactSnap = await col.where('dedupeKey', '==', dedupeKey).limit(5).get();
    for (const docSnap of exactSnap.docs) {
      const rec = hydrateInquiryRecord(docSnap.id, docSnap.data());
      const createdMs = Date.parse(rec.timestamp);
      if (Number.isFinite(createdMs) && nowMs - createdMs <= EXACT_DEDUPE_WINDOW_MS) {
        return rec;
      }
    }

    // 2. Same email + inquiryType rapid burst within 60 seconds (double-click guard)
    const emailSnap = await col.where('senderEmailNormalized', '==', emailNormalized).limit(10).get();
    for (const docSnap of emailSnap.docs) {
      const rec = hydrateInquiryRecord(docSnap.id, docSnap.data());
      const createdMs = Date.parse(rec.timestamp);
      if (
        rec.inquiryType === inquiryType &&
        Number.isFinite(createdMs) &&
        nowMs - createdMs <= RAPID_BURST_DEDUPE_WINDOW_MS
      ) {
        return rec;
      }
    }

    return null;
  }

  async createInquiry(inquiry: InboundInquiry): Promise<InboundInquiry> {
    const docRef = this.db.collection(this.collectionName).doc(inquiry.id);
    await docRef.set(this.toFirestoreDoc(inquiry));
    return inquiry;
  }

  async getInquiryById(id: string): Promise<InboundInquiry | null> {
    const snap = await this.db.collection(this.collectionName).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return data ? hydrateInquiryRecord(snap.id, data) : null;
  }

  async listInquiries(limit = 100): Promise<InboundInquiry[]> {
    const snap = await this.db
      .collection(this.collectionName)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((docSnap) => hydrateInquiryRecord(docSnap.id, docSnap.data()));
  }

  async updateInquiryStatus(
    id: string,
    updates: { status?: InquiryStatus; isRead?: boolean; adminNotes?: string }
  ): Promise<InboundInquiry | null> {
    const docRef = this.db.collection(this.collectionName).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const nowIso = new Date().toISOString();
    const patch: Record<string, any> = {
      updatedAt: new Date(nowIso),
    };
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.isRead !== undefined) patch.isRead = Boolean(updates.isRead);
    if (updates.adminNotes !== undefined) patch.adminNotes = clampField(updates.adminNotes, 1000);

    await docRef.update(patch);
    const refreshed = await docRef.get();
    const data = refreshed.data();
    return data ? hydrateInquiryRecord(refreshed.id, data) : null;
  }

  async updateNotificationResult(
    id: string,
    updates: {
      notificationStatus: NotificationStatus;
      notificationProvider: 'resend' | 'none';
      notificationAttempts: number;
      lastNotificationAttemptAt: string;
      notificationId?: string;
      notificationError?: string;
    }
  ): Promise<InboundInquiry | null> {
    const docRef = this.db.collection(this.collectionName).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const patch = stripUndefinedFields({
      notificationStatus: updates.notificationStatus,
      notificationProvider: updates.notificationProvider,
      notificationAttempts: updates.notificationAttempts,
      lastNotificationAttemptAt: updates.lastNotificationAttemptAt,
      notificationId: updates.notificationId,
      notificationError: updates.notificationError ? clampField(updates.notificationError, 300) : '',
      updatedAt: new Date(),
    });

    await docRef.update(patch);
    const refreshed = await docRef.get();
    const data = refreshed.data();
    return data ? hydrateInquiryRecord(refreshed.id, data) : null;
  }
}

export class MemoryInquiryStore implements InquiryStore {
  private readonly records: InboundInquiry[] = [];

  getMode(): 'firestore' | 'memory' {
    return 'memory';
  }

  async findRecentDuplicate(
    dedupeKey: string,
    emailNormalized: string,
    inquiryType: InquiryType
  ): Promise<InboundInquiry | null> {
    const nowMs = Date.now();
    for (const rec of this.records) {
      const createdMs = Date.parse(rec.timestamp);
      if (!Number.isFinite(createdMs)) continue;
      if (rec.dedupeKey === dedupeKey && nowMs - createdMs <= EXACT_DEDUPE_WINDOW_MS) {
        return { ...rec };
      }
      if (
        (rec.senderEmailNormalized || rec.email.toLowerCase()) === emailNormalized &&
        rec.inquiryType === inquiryType &&
        nowMs - createdMs <= RAPID_BURST_DEDUPE_WINDOW_MS
      ) {
        return { ...rec };
      }
    }
    return null;
  }

  async createInquiry(inquiry: InboundInquiry): Promise<InboundInquiry> {
    const copy = {
      ...inquiry,
      senderEmailNormalized: inquiry.email.trim().toLowerCase(),
    };
    this.records.unshift(copy);
    if (this.records.length > 250) {
      this.records.pop();
    }
    return { ...copy };
  }

  async getInquiryById(id: string): Promise<InboundInquiry | null> {
    const found = this.records.find((r) => r.id === id);
    return found ? { ...found } : null;
  }

  async listInquiries(limit = 100): Promise<InboundInquiry[]> {
    return [...this.records]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  async updateInquiryStatus(
    id: string,
    updates: { status?: InquiryStatus; isRead?: boolean; adminNotes?: string }
  ): Promise<InboundInquiry | null> {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const current = this.records[idx];
    const next: InboundInquiry = {
      ...current,
      status: updates.status !== undefined ? updates.status : current.status,
      isRead: updates.isRead !== undefined ? Boolean(updates.isRead) : current.isRead,
      adminNotes:
        updates.adminNotes !== undefined ? clampField(updates.adminNotes, 1000) : current.adminNotes,
      updatedAt: new Date().toISOString(),
    };
    this.records[idx] = next;
    return { ...next };
  }

  async updateNotificationResult(
    id: string,
    updates: {
      notificationStatus: NotificationStatus;
      notificationProvider: 'resend' | 'none';
      notificationAttempts: number;
      lastNotificationAttemptAt: string;
      notificationId?: string;
      notificationError?: string;
    }
  ): Promise<InboundInquiry | null> {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const current = this.records[idx];
    const next: InboundInquiry = {
      ...current,
      notificationStatus: updates.notificationStatus,
      notificationProvider: updates.notificationProvider,
      notificationAttempts: updates.notificationAttempts,
      lastNotificationAttemptAt: updates.lastNotificationAttemptAt,
      notificationId: updates.notificationId ?? current.notificationId,
      notificationError: updates.notificationError
        ? clampField(updates.notificationError, 300)
        : undefined,
      updatedAt: new Date().toISOString(),
    };
    this.records[idx] = next;
    return { ...next };
  }
}

export function isFirestorePermissionOrUnavailableError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'string') {
    return /PERMISSION_DENIED|Missing or insufficient permissions|Could not load the default credentials|UNAUTHENTICATED|UNAVAILABLE/i.test(
      err
    );
  }
  if (typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  const message = String((err as { message?: unknown }).message || '');
  // gRPC codes: 5 NOT_FOUND, 7 PERMISSION_DENIED, 14 UNAVAILABLE, 16 UNAUTHENTICATED
  if (
    code === 7 ||
    code === 14 ||
    code === 16 ||
    code === 5 ||
    code === 'permission-denied' ||
    code === 'unavailable' ||
    code === 'unauthenticated'
  ) {
    return true;
  }
  return /PERMISSION_DENIED|Missing or insufficient permissions|Could not load the default credentials|UNAUTHENTICATED|DECODER routines|invalid_grant/i.test(
    message
  );
}

/**
 * Wraps FirestoreInquiryStore with automatic in-memory fallback when the active
 * server container lacks cross-project Firestore IAM permissions (e.g. gRPC 7 PERMISSION_DENIED)
 * or ADC credentials, preventing 500 errors on Admin Inquiry Management and public submissions.
 */
export class ResilientInquiryStore implements InquiryStore {
  private fallbackActive = false;
  private warnedFallback = false;
  private fallbackReason: string | null = null;

  constructor(
    private readonly primary: InquiryStore,
    private readonly fallback: InquiryStore = new MemoryInquiryStore()
  ) {}

  getMode(): 'firestore' | 'memory' {
    return this.fallbackActive ? this.fallback.getMode() : this.primary.getMode();
  }

  getFallbackReason(): string | null {
    return this.fallbackReason;
  }

  private async runWithFallback<T>(opName: string, fn: (store: InquiryStore) => Promise<T>): Promise<T> {
    if (this.fallbackActive) {
      return fn(this.fallback);
    }
    try {
      return await fn(this.primary);
    } catch (err) {
      if (isFirestorePermissionOrUnavailableError(err)) {
        this.fallbackActive = true;
        this.fallbackReason =
          'Firestore Admin SDK permissions are unavailable in this runtime; using in-memory session storage.';
        if (!this.warnedFallback) {
          this.warnedFallback = true;
          console.warn(
            `[InquiryStore] Firestore unavailable during ${opName} (${
              err instanceof Error ? err.message : 'permission/connectivity error'
            }). Falling back to in-memory storage.`
          );
        }
        return fn(this.fallback);
      }
      throw err;
    }
  }

  findRecentDuplicate(
    dedupeKey: string,
    emailNormalized: string,
    inquiryType: InquiryType
  ): Promise<InboundInquiry | null> {
    return this.runWithFallback('findRecentDuplicate', (s) =>
      s.findRecentDuplicate(dedupeKey, emailNormalized, inquiryType)
    );
  }

  createInquiry(inquiry: InboundInquiry): Promise<InboundInquiry> {
    return this.runWithFallback('createInquiry', (s) => s.createInquiry(inquiry));
  }

  getInquiryById(id: string): Promise<InboundInquiry | null> {
    return this.runWithFallback('getInquiryById', (s) => s.getInquiryById(id));
  }

  listInquiries(limit?: number): Promise<InboundInquiry[]> {
    return this.runWithFallback('listInquiries', (s) => s.listInquiries(limit));
  }

  updateInquiryStatus(
    id: string,
    updates: { status?: InquiryStatus; isRead?: boolean; adminNotes?: string }
  ): Promise<InboundInquiry | null> {
    return this.runWithFallback('updateInquiryStatus', (s) => s.updateInquiryStatus(id, updates));
  }

  updateNotificationResult(
    id: string,
    updates: {
      notificationStatus: NotificationStatus;
      notificationProvider: 'resend' | 'none';
      notificationAttempts: number;
      lastNotificationAttemptAt: string;
      notificationId?: string;
      notificationError?: string;
    }
  ): Promise<InboundInquiry | null> {
    return this.runWithFallback('updateNotificationResult', (s) =>
      s.updateNotificationResult(id, updates)
    );
  }
}

