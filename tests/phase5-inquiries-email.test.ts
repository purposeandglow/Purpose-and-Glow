import http from 'http';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../server.ts';
import { createRequireAdminAuth } from '../src/middleware/auth.ts';
import {
  FirestoreInquiryStore,
  ResilientInquiryStore,
  type InboundInquiry
} from '../src/lib/inquiryStore.ts';
import { ResendEmailNotifier } from '../src/lib/resendNotifier.ts';
import { getAdminFirestoreForInquiries } from '../src/lib/firebase-admin.ts';

/**
 * Minimal in-memory Firestore Admin SDK shim that faithfully reproduces
 * `.collection('inquiries').doc(id).set/get/update` and `.where/.orderBy/.limit/.get()`
 * so persistence across simulated server restarts is tested deterministically
 * without network calls or live Firebase credentials.
 */
function createMockFirestoreDb() {
  const store = new Map<string, Record<string, any>>();

  function assertNoUndefined(obj: Record<string, any>) {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) {
        throw new Error(`Cannot use "undefined" as a Firestore value (field "${k}")`);
      }
    }
  }

  function makeSnap(id: string, data: Record<string, any> | undefined) {
    return {
      id,
      exists: Boolean(data),
      data: () => (data ? { ...data } : undefined)
    };
  }

  function buildQuery(filters: Array<{ field: string; value: any }> = [], sortDescField?: string, limitCount?: number) {
    return {
      where(field: string, op: string, value: any) {
        if (op !== '==') throw new Error(`Unsupported mock op: ${op}`);
        return buildQuery([...filters, { field, value }], sortDescField, limitCount);
      },
      orderBy(field: string, dir: string) {
        if (dir !== 'desc') throw new Error(`Unsupported mock dir: ${dir}`);
        return buildQuery(filters, field, limitCount);
      },
      limit(n: number) {
        return buildQuery(filters, sortDescField, n);
      },
      async get() {
        let rows = Array.from(store.entries()).map(([id, data]) => ({ id, data }));
        for (const f of filters) {
          rows = rows.filter((r) => r.data[f.field] === f.value);
        }
        if (sortDescField) {
          rows.sort((a, b) =>
            String(b.data[sortDescField] || '').localeCompare(String(a.data[sortDescField] || ''))
          );
        }
        if (typeof limitCount === 'number') {
          rows = rows.slice(0, limitCount);
        }
        return {
          docs: rows.map((r) => makeSnap(r.id, r.data))
        };
      }
    };
  }

  const dbShim = {
    collection(_name: string) {
      return {
        doc(id: string) {
          return {
            async set(payload: Record<string, any>) {
              assertNoUndefined(payload);
              store.set(id, { ...payload });
            },
            async get() {
              return makeSnap(id, store.get(id));
            },
            async update(patch: Record<string, any>) {
              assertNoUndefined(patch);
              const existing = store.get(id);
              if (!existing) throw new Error(`Doc ${id} does not exist`);
              store.set(id, { ...existing, ...patch });
            }
          };
        },
        where(field: string, op: string, value: any) {
          return buildQuery([], undefined, undefined).where(field, op, value);
        },
        orderBy(field: string, dir: string) {
          return buildQuery([], undefined, undefined).orderBy(field, dir);
        },
        limit(n: number) {
          return buildQuery([], undefined, undefined).limit(n);
        }
      };
    }
  };

  return { dbShim: dbShim as any, rawMap: store };
}

const tokenVerifier = async (token: string) => {
  if (token === 'valid-admin-token') {
    return {
      uid: 'uid-nicole',
      email: 'purposeandglowcareers@gmail.com',
      email_verified: true
    } as any;
  }
  if (token === 'unverified-admin-token') {
    return {
      uid: 'uid-spoof',
      email: 'purposeandglowcareers@gmail.com',
      email_verified: false
    } as any;
  }
  if (token === 'other-verified-token') {
    return {
      uid: 'uid-other',
      email: 'other@example.com',
      email_verified: true
    } as any;
  }
  throw new Error('Invalid token');
};

async function startTestServer(app: any): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

describe('Phase 5: Persistent Firestore /inquiries, Resend Notifications & Inquiry Management', () => {
  it('enforces admin-only access on all inquiry management & retry endpoints', async () => {
    const { dbShim } = createMockFirestoreDb();
    const inquiryStore = new FirestoreInquiryStore(dbShim);
    const { app } = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: null,
      inquiryStoreOverride: inquiryStore
    });
    const { server, baseUrl } = await startTestServer(app);

    try {
      const protectedEndpoints: Array<{ method: 'GET' | 'PATCH' | 'POST'; path: string; body?: any }> = [
        { method: 'GET', path: '/api/contact/inquiries' },
        { method: 'PATCH', path: '/api/contact/inquiries/inq-1/read', body: { isRead: true } },
        { method: 'PATCH', path: '/api/contact/inquiries/inq-1/status', body: { status: 'contacted' } },
        { method: 'POST', path: '/api/contact/inquiries/inq-1/retry-notification' }
      ];

      for (const ep of protectedEndpoints) {
        const noAuth = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: ep.body ? { 'Content-Type': 'application/json' } : undefined,
          body: ep.body ? JSON.stringify(ep.body) : undefined
        });
        expect(noAuth.status, `Expected 401 for unauthenticated ${ep.method} ${ep.path}`).toBe(401);

        const spoofed = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: 'Bearer unverified-admin-token',
            ...(ep.body ? { 'Content-Type': 'application/json' } : {})
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined
        });
        expect(spoofed.status, `Expected 403 for unverified email ${ep.method} ${ep.path}`).toBe(403);

        const nonAdmin = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: 'Bearer other-verified-token',
            ...(ep.body ? { 'Content-Type': 'application/json' } : {})
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined
        });
        expect(nonAdmin.status, `Expected 403 for non-admin ${ep.method} ${ep.path}`).toBe(403);
      }
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('persists contact & complimentary human review inquiries across server restarts, prevents duplicates/Tally duplicates, and blocks full résumé storage', async () => {
    const { dbShim, rawMap } = createMockFirestoreDb();
    const inquiryStore = new FirestoreInquiryStore(dbShim);

    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { app } = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: null,
      inquiryStoreOverride: inquiryStore
    });
    const { server, baseUrl } = await startTestServer(app);

    try {
      // 1. Rejects payloads containing uploaded résumé files or full multi-section résumés
      const resumeUploadAttempt = await fetch(`${baseUrl}/api/contact/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alex Applicant',
          email: 'alex.private@example.com',
          message: 'Please review my attached resume.',
          resumeText: 'FULL RESUME TEXT SHOULD NOT BE STORED IN FIRESTORE...'
        })
      });
      expect(resumeUploadAttempt.status).toBe(400);
      const resumeRejectJson = await resumeUploadAttempt.json();
      expect(resumeRejectJson.errorCode).toBe('RESUME_STORAGE_PROHIBITED');
      expect(rawMap.size).toBe(0);

      // Rejects pasted multi-section full résumé in human review notes
      const fullPasteAttempt = await fetch(`${baseUrl}/api/assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Alex Applicant',
          email: 'alex.private@example.com',
          agreedToTerms: true,
          resumeNotes: `PROFESSIONAL SUMMARY\nExperienced revenue cycle specialist with 9 years across hospital outpatient billing.\nWORK EXPERIENCE\n${'- Managed billing queue\n'.repeat(
            12
          )}\nEDUCATION\nB.S. Healthcare Administration\nSKILLS\nEpic, ICD-10, CPT, Claim Appeals, Prior Authorizations. ${'Details '.repeat(
            90
          )}`
        })
      });
      expect(fullPasteAttempt.status).toBe(400);
      expect((await fullPasteAttempt.json()).errorCode).toBe('RESUME_STORAGE_PROHIBITED');

      // 2. Blocks duplicate inquiry creation when coming from Tally
      const tallySubmit = await fetch(`${baseUrl}/api/assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Tally Visitor',
          email: 'tally.visitor@example.com',
          source: 'tally'
        })
      });
      expect(tallySubmit.status).toBe(200);
      const tallyJson = await tallySubmit.json();
      expect(tallyJson.skippedDuplicate).toBe(true);
      expect(rawMap.size).toBe(0);

      // 3. Submit valid website contact form & complimentary human review -> saved with zero PII echoed in public response or logs
      const contactRes = await fetch(`${baseUrl}/api/contact/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Priya Nair',
          email: 'priya.nair@example.com',
          phone: '612-555-0194',
          service: 'Résumé Revamp ($99)',
          currentRole: 'Patient Access Specialist',
          targetRole: 'Revenue Cycle Coordinator',
          urgency: 'urgent_48h',
          message: 'Looking for help highlighting my scheduling and insurance verification work.'
        })
      });
      expect(contactRes.status).toBe(200);
      const contactPublicBody = await contactRes.json();
      expect(contactPublicBody.success).toBe(true);
      expect(contactPublicBody.duplicate).toBe(false);
      // Zero applicant PII leaked in public HTTP response
      expect(JSON.stringify(contactPublicBody)).not.toContain('priya.nair@example.com');
      expect(JSON.stringify(contactPublicBody)).not.toContain('612-555-0194');
      expect(JSON.stringify(contactPublicBody)).not.toContain('Priya Nair');
      // Zero applicant PII leaked in console logs
      const loggedText = logSpy.mock.calls.flat().join(' ');
      expect(loggedText).not.toContain('priya.nair@example.com');
      expect(loggedText).not.toContain('Priya Nair');

      // Duplicate contact submission within 24h returns duplicate=true and does NOT create a second doc
      const dupContactRes = await fetch(`${baseUrl}/api/contact/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Priya Nair',
          email: 'PRIYA.NAIR@example.com',
          service: 'Résumé Revamp ($99)',
          message: 'Looking for help highlighting my scheduling and insurance verification work.'
        })
      });
      expect(dupContactRes.status).toBe(200);
      const dupJson = await dupContactRes.json();
      expect(dupJson.duplicate).toBe(true);
      expect(dupJson.id).toBe(contactPublicBody.id);
      expect(rawMap.size).toBe(1);

      // Submit complimentary human review inquiry
      const assessRes = await fetch(`${baseUrl}/api/assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Marcus Bell',
          email: 'marcus.bell@example.com',
          currentTitle: 'Billing Representative',
          targetTitles: 'Revenue Cycle Lead',
          preferredIndustry: 'Healthcare / Clinical / Revenue Cycle',
          locationState: 'Minnesota',
          primaryAssistance: 'Free DIY Recommendations ($0)',
          resumeNotes: 'I want advice before applying for clinic lead openings.',
          agreedToTerms: true
        })
      });
      expect(assessRes.status).toBe(200);
      const assessBody = await assessRes.json();
      expect(assessBody.inquiry.inquiryType).toBe('complimentary_human_review');
      expect(rawMap.size).toBe(2);
    } finally {
      logSpy.mockRestore();
      await new Promise<void>((r) => server.close(() => r()));
    }

    // 4. Simulate complete server restart with a brand-new Express app connected to the same Firestore dbShim
    const restartedAppResult = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: null,
      inquiryStoreOverride: new FirestoreInquiryStore(dbShim)
    });
    const { server: srv2, baseUrl: url2 } = await startTestServer(restartedAppResult.app);

    try {
      const adminListRes = await fetch(`${url2}/api/contact/inquiries`, {
        headers: { Authorization: 'Bearer valid-admin-token' }
      });
      expect(adminListRes.status).toBe(200);
      const adminList = await adminListRes.json();
      expect(adminList.storageMode).toBe('firestore');
      expect(adminList.totalCount).toBe(2);
      expect(adminList.unreadCount).toBe(2);
      expect(adminList.statusCounts.new).toBe(2);
      expect(adminList.inquiries.map((i: InboundInquiry) => i.name)).toEqual(
        expect.arrayContaining(['Priya Nair', 'Marcus Bell'])
      );
    } finally {
      await new Promise<void>((r) => srv2.close(() => r()));
    }
  });

  it('saves inquiry BEFORE attempting Resend notification, records email failures safely without losing data, and supports admin status updates + email retry', async () => {
    const { dbShim } = createMockFirestoreDb();
    const inquiryStore = new FirestoreInquiryStore(dbShim);

    let shouldFailResend = true;
    const mockFetch = vi.fn(async (_url: string, _init?: RequestInit) => {
      if (shouldFailResend) {
        return new Response(JSON.stringify({ message: 'Domain not verified yet' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ id: 're_mock_msg_999' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const notifier = new ResendEmailNotifier(
      {
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test_mock_key',
        RESEND_FROM_EMAIL: 'noreply@purposeglowcareer.com',
        BUSINESS_EMAIL: 'purposeandglowcareers@gmail.com'
      } as NodeJS.ProcessEnv,
      mockFetch as unknown as typeof fetch
    );

    const { app } = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: null,
      inquiryStoreOverride: inquiryStore,
      emailNotifierOverride: notifier
    });
    const { server, baseUrl } = await startTestServer(app);

    try {
      // 1. Resend fails (403 Domain not verified) -> inquiry MUST still be saved cleanly with notificationStatus='failed'
      const submitRes = await fetch(`${baseUrl}/api/contact/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Elena Rostova',
          email: 'elena@example.com',
          service: 'Targeted Cover Letter ($49)',
          message: 'Need a tailored cover letter for clinic operations.'
        })
      });
      expect(submitRes.status).toBe(200);
      const submitJson = await submitRes.json();
      expect(submitJson.success).toBe(true);
      expect(submitJson.inquiry.notificationStatus).toBe('failed');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const listAfterFail = await fetch(`${baseUrl}/api/contact/inquiries`, {
        headers: { Authorization: 'Bearer valid-admin-token' }
      });
      const listJson = await listAfterFail.json();
      expect(listJson.emailConfigured).toBe(true);
      expect(listJson.totalCount).toBe(1);
      const saved = listJson.inquiries[0] as InboundInquiry;
      expect(saved.notificationStatus).toBe('failed');
      expect(saved.notificationAttempts).toBe(1);
      expect(saved.notificationError).toContain('Domain not verified yet');
      expect(saved.status).toBe('new');

      // 2. Admin retries notification after fixing domain verification -> succeeds & updates attempt count + messageId
      shouldFailResend = false;
      const retryRes = await fetch(
        `${baseUrl}/api/contact/inquiries/${encodeURIComponent(saved.id)}/retry-notification`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-admin-token' }
        }
      );
      expect(retryRes.status).toBe(200);
      const retryJson = await retryRes.json();
      expect(retryJson.success).toBe(true);
      expect(retryJson.inquiry.notificationStatus).toBe('sent');
      expect(retryJson.inquiry.notificationAttempts).toBe(2);
      expect(retryJson.inquiry.notificationId).toBe('re_mock_msg_999');

      // Verify exact Resend payload targets purposeandglowcareers@gmail.com with applicant reply_to
      const lastCallArgs = mockFetch.mock.calls[1];
      const sentPayload = JSON.parse(String(lastCallArgs[1]?.body));
      expect(sentPayload.to).toEqual(['purposeandglowcareers@gmail.com']);
      expect(sentPayload.reply_to).toBe('elena@example.com');
      expect(sentPayload.from).toContain('noreply@purposeglowcareer.com');

      // 3. Admin status updates across all 5 workflow states + validation against invalid status
      const badStatusRes = await fetch(
        `${baseUrl}/api/contact/inquiries/${encodeURIComponent(saved.id)}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer valid-admin-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'bogus_status' })
        }
      );
      expect(badStatusRes.status).toBe(400);

      for (const nextStatus of ['contacted', 'in_progress', 'completed', 'closed']) {
        const statusRes = await fetch(
          `${baseUrl}/api/contact/inquiries/${encodeURIComponent(saved.id)}/status`,
          {
            method: 'PATCH',
            headers: {
              Authorization: 'Bearer valid-admin-token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: nextStatus,
              adminNotes: `Moved to ${nextStatus}`
            })
          }
        );
        expect(statusRes.status).toBe(200);
        const statusJson = await statusRes.json();
        expect(statusJson.inquiry.status).toBe(nextStatus);
        expect(statusJson.inquiry.adminNotes).toBe(`Moved to ${nextStatus}`);
      }
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('keeps real Resend network calls disabled in Vitest and preserves Tally links & unapproved rules untouched', () => {
    // 1. Live Firestore Admin helper stays null in Vitest unless explicitly forced
    expect(getAdminFirestoreForInquiries({ VITEST: 'true' } as NodeJS.ProcessEnv)).toBeNull();

    // 2. ResendEmailNotifier reports not_configured cleanly without credentials
    const unconfiguredNotifier = new ResendEmailNotifier({} as NodeJS.ProcessEnv);
    expect(unconfiguredNotifier.isConfigured()).toBe(false);
    expect(unconfiguredNotifier.getMissingConfigReasons().length).toBeGreaterThanOrEqual(2);

    // 3. Tally links and proposed rules draft preserved without altering deployed firestore.rules
    const clientSite = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ClientFacingSite.tsx'),
      'utf8'
    );
    const assessmentModal = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/FreeAssessmentModal.tsx'),
      'utf8'
    );
    const rulesFile = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    expect(clientSite).toContain('https://tally.so/r/q5a1RY');
    expect(assessmentModal).toContain('https://tally.so/r/q5a1RY');
    expect(rulesFile).toContain("data.status in ['new', 'reviewed', 'responded']");
    expect(fs.existsSync(path.resolve(process.cwd(), 'DRAFT_firestore_inquiries_rules_proposal.md'))).toBe(
      true
    );
  });

  it('safely defaults K_SERVICE development containers to memory and falls back cleanly on Firestore 7 PERMISSION_DENIED without HTTP 500 or lost inquiries', async () => {
    // 1. Managed container env vars (K_SERVICE) in development must not attempt cross-project Firestore Admin calls
    expect(
      getAdminFirestoreForInquiries({
        NODE_ENV: 'development',
        K_SERVICE: 'ais-dev-container'
      } as NodeJS.ProcessEnv)
    ).toBeNull();

    // 2. If Firestore Admin throws gRPC 7 PERMISSION_DENIED at runtime, ResilientInquiryStore degrades cleanly to memory
    const permissionDeniedError = Object.assign(
      new Error('7 PERMISSION_DENIED: Missing or insufficient permissions.'),
      { code: 7 }
    );
    const brokenFirestoreDb = {
      collection: () => ({
        doc: () => ({
          set: async () => {
            throw permissionDeniedError;
          },
          get: async () => {
            throw permissionDeniedError;
          },
          update: async () => {
            throw permissionDeniedError;
          }
        }),
        where: () => ({
          limit: () => ({
            get: async () => {
              throw permissionDeniedError;
            }
          })
        }),
        orderBy: () => ({
          limit: () => ({
            get: async () => {
              throw permissionDeniedError;
            }
          })
        })
      })
    } as any;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resilientStore = new ResilientInquiryStore(new FirestoreInquiryStore(brokenFirestoreDb));
    const { app } = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: null,
      inquiryStoreOverride: resilientStore
    });
    const { server, baseUrl } = await startTestServer(app);

    try {
      // Listing inquiries must succeed (200) in fallback memory mode instead of crashing with 500
      const listRes = await fetch(`${baseUrl}/api/contact/inquiries`, {
        headers: { Authorization: 'Bearer valid-admin-token' }
      });
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);
      expect(listJson.storageMode).toBe('memory');
      expect(listJson.storageWarning).toContain('in-memory');
      expect(listJson.inquiries).toEqual([]);
      expect(errSpy).not.toHaveBeenCalled();

      // Submitting a public contact inquiry after fallback must save cleanly in memory and remain queryable
      const submitRes = await fetch(`${baseUrl}/api/contact/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jordan Lee',
          email: 'jordan.lee@example.com',
          service: 'Résumé Revamp ($99)',
          message: 'Please review my hospital patient access résumé.'
        })
      });
      expect(submitRes.status).toBe(200);
      const submitJson = await submitRes.json();
      expect(submitJson.success).toBe(true);

      const listAfterRes = await fetch(`${baseUrl}/api/contact/inquiries`, {
        headers: { Authorization: 'Bearer valid-admin-token' }
      });
      expect(listAfterRes.status).toBe(200);
      const listAfterJson = await listAfterRes.json();
      expect(listAfterJson.totalCount).toBe(1);
      expect(listAfterJson.inquiries[0].name).toBe('Jordan Lee');
    } finally {
      warnSpy.mockRestore();
      errSpy.mockRestore();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

