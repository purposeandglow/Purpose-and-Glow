import fs from 'fs';
import path from 'path';
import http from 'http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server.ts';
import { createRequireAdminAuth } from '../src/middleware/auth.ts';
import { isVerifiedAdminUser } from '../src/lib/firebase.ts';
import { buildClientDataBackup, restoreClientDataBackup } from '../src/lib/dataBackup.ts';
import {
  buildFirestoreLeadPayload,
  buildFirestoreKeywordRulePayload,
  buildFirestoreChatMessagePayload,
  hydrateLeadFromFirestore,
  hydrateKeywordRuleFromFirestore,
  mergeLocalAndCloudRecords,
  sanitizeFirestoreId
} from '../src/lib/firestoreStore.ts';

function collectSrcFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSrcFiles(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Phase 2 Integration: Express Admin API Authentication & Authorization', () => {
  let server: http.Server;
  let baseUrl = '';

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
        uid: 'uid-visitor',
        email: 'visitor@example.com',
        email_verified: true
      } as any;
    }
    throw new Error('Invalid or expired Firebase ID token');
  };

  beforeAll(async () => {
    const adminMiddleware = createRequireAdminAuth(tokenVerifier);
    const { app } = createApp({
      adminMiddleware,
      aiClientOverride: null
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  const adminRoutes: Array<{ method: 'GET' | 'POST' | 'PATCH'; path: string; body?: any }> = [
    { method: 'GET', path: '/api/signals/live-stream' },
    { method: 'GET', path: '/api/signals/scan-icp?cluster=all' },
    { method: 'GET', path: '/api/signals/scan-linkedin?topic=rcm' },
    { method: 'POST', path: '/api/signals/parse-paste', body: { pastedText: 'Need resume review' } },
    { method: 'POST', path: '/api/signals/qualify-live', body: { rawText: 'Need resume review' } },
    { method: 'GET', path: '/api/feeds/status' },
    { method: 'GET', path: '/api/contact/inquiries' },
    { method: 'PATCH', path: '/api/contact/inquiries/inq-1/read', body: { isRead: true } },
    { method: 'POST', path: '/api/auth/sync', body: { displayName: 'Nicole' } },
    { method: 'GET', path: '/api/leads/saved' },
    {
      method: 'POST',
      path: '/api/leads/save',
      body: {
        id: 'lead-auth-test',
        personName: 'Test Candidate',
        headline: 'Medical Biller',
        location: 'MN',
        sourceType: 'Public LinkedIn Post',
        sourceContext: 'Test',
        rawText: 'Updating resume',
        status: 'new_signal',
        recommendedPackageId: 'revamp_99'
      }
    },
    { method: 'PATCH', path: '/api/leads/status', body: { leadId: 'lead-auth-test', status: 'contacted' } },
    { method: 'POST', path: '/api/copilot/chat', body: { message: 'Diagnose lead' } },
    { method: 'GET', path: '/api/copilot/history' },
    { method: 'GET', path: '/api/admin/system/gemini-models' },
    { method: 'GET', path: '/api/admin/backup/snapshot' }
  ];

  it('rejects unauthenticated requests (401) across ALL 16 Admin API endpoints', async () => {
    for (const route of adminRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: route.body ? { 'Content-Type': 'application/json' } : undefined,
        body: route.body ? JSON.stringify(route.body) : undefined
      });
      expect(res.status, `Expected 401 on ${route.method} ${route.path}`).toBe(401);
    }
  });

  it('rejects invalid Bearer tokens (401) across ALL 16 Admin API endpoints', async () => {
    for (const route of adminRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          Authorization: 'Bearer forged.jwt.token',
          ...(route.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: route.body ? JSON.stringify(route.body) : undefined
      });
      expect(res.status, `Expected 401 for bad token on ${route.method} ${route.path}`).toBe(401);
    }
  });

  it('rejects spoofed admin email with email_verified=false (403) across ALL 16 Admin API endpoints', async () => {
    for (const route of adminRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          Authorization: 'Bearer unverified-admin-token',
          ...(route.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: route.body ? JSON.stringify(route.body) : undefined
      });
      expect(res.status, `Expected 403 for unverified email on ${route.method} ${route.path}`).toBe(403);
    }
  });

  it('rejects other verified non-admin Google accounts (403) across ALL 16 Admin API endpoints', async () => {
    for (const route of adminRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          Authorization: 'Bearer other-verified-token',
          ...(route.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: route.body ? JSON.stringify(route.body) : undefined
      });
      expect(res.status, `Expected 403 for non-admin account on ${route.method} ${route.path}`).toBe(403);
    }
  });

  it('allows verified business founder account across protected Admin routes and preserves submitted client inquiries', async () => {
    // 1. Public inquiries list starts empty (no fake pre-seeded PII)
    const initInqRes = await fetch(`${baseUrl}/api/contact/inquiries`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    expect(initInqRes.status).toBe(200);
    const initInqJson = await initInqRes.json();
    expect(initInqJson.count).toBe(0);

    // 2. Public visitor submits contact inquiry without auth
    const contactRes = await fetch(`${baseUrl}/api/contact/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morgan Taylor',
        email: 'morgan@example.com',
        service: 'Résumé Revamp ($99)',
        message: 'Looking to refresh my medical billing resume.',
        recipientEmail: 'attacker@evil.example'
      })
    });
    expect(contactRes.status).toBe(200);
    const contactJson = await contactRes.json();
    expect(contactJson.success).toBe(true);
    expect(contactJson.inquiry.recipientEmail).toBe('purposeandglowcareers@gmail.com');

    // 3. Verified Admin reads the newly submitted inquiry & marks it read
    const afterInqRes = await fetch(`${baseUrl}/api/contact/inquiries`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    const afterInqJson = await afterInqRes.json();
    expect(afterInqJson.count).toBe(1);
    expect(afterInqJson.inquiries[0].name).toBe('Morgan Taylor');

    const patchReadRes = await fetch(
      `${baseUrl}/api/contact/inquiries/${afterInqJson.inquiries[0].id}/read`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isRead: true })
      }
    );
    expect(patchReadRes.status).toBe(200);

    // 4. Verified Admin accesses feeds, LinkedIn scan, parse-paste, leads, copilot, and system status
    const feedsRes = await fetch(`${baseUrl}/api/feeds/status`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    expect(feedsRes.status).toBe(200);

    const linkedInRes = await fetch(`${baseUrl}/api/signals/scan-linkedin?topic=rcm`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    expect(linkedInRes.status).toBe(200);
    const linkedInJson = await linkedInRes.json();
    expect(linkedInJson.count).toBeGreaterThan(0);

    const parseRes = await fetch(`${baseUrl}/api/signals/parse-paste`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pastedText: 'Alex Jordan - 6 years medical billing denials experience, Minneapolis, MN'
      })
    });
    expect(parseRes.status).toBe(200);
    const parseJson = await parseRes.json();
    expect(parseJson.lead.detectedCluster).toBe('healthcare_rcm');

    const saveLeadRes = await fetch(`${baseUrl}/api/leads/save`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 'lead-integration-1',
        personName: 'Alex Jordan',
        headline: 'Medical Biller',
        location: 'Minneapolis, MN',
        sourceType: 'Public LinkedIn Post',
        sourceContext: 'Integration Test',
        rawText: '6 years denials experience',
        status: 'new_signal',
        recommendedPackageId: 'revamp_99'
      })
    });
    expect(saveLeadRes.status).toBe(200);

    const savedLeadsRes = await fetch(`${baseUrl}/api/leads/saved`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    expect(savedLeadsRes.status).toBe(200);
    const savedLeadsJson = await savedLeadsRes.json();
    expect(savedLeadsJson.leads.some((l: any) => l.id === 'lead-integration-1')).toBe(true);

    const chatRes = await fetch(`${baseUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Summarize positioning gap' })
    });
    expect(chatRes.status).toBe(200);

    const historyRes = await fetch(`${baseUrl}/api/copilot/history`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    expect(historyRes.status).toBe(200);
    const historyJson = await historyRes.json();
    expect(historyJson.history.length).toBeGreaterThanOrEqual(2);

    const modelsRes = await fetch(`${baseUrl}/api/admin/system/gemini-models`, {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    expect(modelsRes.status).toBe(200);
    const modelsJson = await modelsRes.json();
    expect(modelsJson.publicAiEnabled).toBe(false);
  });

  it('keeps public contact and assessment endpoints working and rejects incomplete public payloads (400)', async () => {
    const badContact = await fetch(`${baseUrl}/api/contact/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Missing Email' })
    });
    expect(badContact.status).toBe(400);

    const badAssess = await fetch(`${baseUrl}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Only Name' })
    });
    expect(badAssess.status).toBe(400);

    const okAssess = await fetch(`${baseUrl}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Casey Jordan',
        email: 'casey@example.com',
        primaryAssistance: 'Résumé Revamp ($99)'
      })
    });
    expect(okAssess.status).toBe(200);
  });
});

describe('Phase 2 Hardcoded PIN Removal, Firebase Admin Verification & Data Preservation', () => {
  it('completely removes hardcoded PIN 0313, AdminPinModal, and sessionStorage pg_admin_authed bypass from src/', () => {
    const srcFiles = collectSrcFiles(path.resolve(process.cwd(), 'src'));
    expect(srcFiles.length).toBeGreaterThan(5);
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `Hardcoded PIN found in ${file}`).not.toContain('0313');
      expect(content, `Legacy AdminPinModal reference found in ${file}`).not.toContain('AdminPinModal');
      expect(content, `Legacy sessionStorage bypass found in ${file}`).not.toContain('pg_admin_authed');
    }
  });

  it('enforces verified business Google email in client helper isVerifiedAdminUser()', () => {
    expect(isVerifiedAdminUser(null)).toBe(false);
    expect(
      isVerifiedAdminUser({ email: 'purposeandglowcareers@gmail.com', emailVerified: false } as any)
    ).toBe(false);
    expect(
      isVerifiedAdminUser({ email: 'other@gmail.com', emailVerified: true } as any)
    ).toBe(false);
    expect(
      isVerifiedAdminUser({ email: 'PurposeAndGlowCareers@gmail.com', emailVerified: true } as any)
    ).toBe(true);
  });

  it('sanitizes and clamps Firestore payloads according to firebase-blueprint.json boundaries', () => {
    expect(sanitizeFirestoreId('bad id/with$chars!')).toMatch(/^[a-zA-Z0-9_-]+$/);

    const leadPayload = buildFirestoreLeadPayload(
      {
        id: 'lead/weird id',
        personName: 'A'.repeat(200),
        headline: 'H'.repeat(300),
        rawText: 'R'.repeat(13000),
        status: 'booked_client',
        fitScore: 145
      },
      { uid: 'uid-admin-1', email: 'purposeandglowcareers@gmail.com' }
    );

    expect(leadPayload.id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(leadPayload.personName.length).toBeLessThanOrEqual(120);
    expect(leadPayload.headline.length).toBeLessThanOrEqual(240);
    expect(leadPayload.rawText.length).toBeLessThanOrEqual(12000);
    expect(leadPayload.fitScore).toBe(100);
    expect(leadPayload.status).toBe('booked_client');

    const rulePayload = buildFirestoreKeywordRulePayload(
      {
        id: 'rule 1',
        phrase: 'denial appeals',
        cluster: 'healthcare_rcm_authority',
        clusterLabel: 'Healthcare RCM',
        weight: 250,
        rationale: 'Strong ICP match',
        enabled: true
      },
      { uid: 'uid-admin-1', email: 'purposeandglowcareers@gmail.com' }
    );
    expect(rulePayload.weight).toBe(100);
    expect(rulePayload.id).toMatch(/^[a-zA-Z0-9_-]+$/);

    const chatPayload = buildFirestoreChatMessagePayload(
      {
        id: 'msg-1',
        role: 'user',
        content: 'Draft a helpful comment',
        relatedLeadId: 'lead-123'
      },
      { uid: 'uid-admin-1', email: 'purposeandglowcareers@gmail.com' }
    );
    expect(chatPayload.ownerUid).toBe('uid-admin-1');
    expect(chatPayload.relatedLeadId).toBe('lead-123');
  });

  it('restores verified backup bundles non-destructively while preserving existing client records', async () => {
    const originalData: Record<string, string> = {
      pg_lead_signals: JSON.stringify([{ id: 'existing-lead', personName: 'Existing Client' }]),
      pg_keyword_rules: JSON.stringify([{ id: 'existing-rule', phrase: 'epic', weight: 20 }]),
      pg_admin_notifications: JSON.stringify([{ id: 'existing-notif', senderName: 'Existing Sender' }]),
      pg_reqs_v2: JSON.stringify({ reqExisting: { id: 'reqExisting', first: 'Existing Req' } })
    };

    const backupSourceStorage = {
      getItem: (k: string) => originalData[k] ?? null
    };
    const bundle = await buildClientDataBackup(backupSourceStorage, null);

    // Target browser has a newer lead & request that must NOT be wiped during restore
    const targetState: Record<string, string> = {
      pg_lead_signals: JSON.stringify([{ id: 'newer-lead', personName: 'Newer Lead' }]),
      pg_keyword_rules: JSON.stringify([]),
      pg_admin_notifications: JSON.stringify([]),
      pg_reqs_v2: JSON.stringify({ reqNew: { id: 'reqNew', first: 'Newer Req' } })
    };
    const targetStorage = {
      getItem: (k: string) => targetState[k] ?? null,
      setItem: (k: string, v: string) => {
        targetState[k] = v;
      }
    };

    const restoreResult = await restoreClientDataBackup(bundle, targetStorage);
    expect(restoreResult.restored).toBe(true);
    expect(restoreResult.mergedCounts.leads).toBe(2);
    expect(restoreResult.mergedCounts.clientRequests).toBe(2);
    expect(restoreResult.mergedCounts.notifications).toBe(1);
    expect(restoreResult.mergedCounts.keywordRules).toBe(1);

    const savedLeads = JSON.parse(targetState.pg_lead_signals);
    expect(savedLeads.map((l: any) => l.id)).toEqual(
      expect.arrayContaining(['newer-lead', 'existing-lead'])
    );
  });

  it('hydrates Firestore leads & keyword rules cleanly and preserves local browser records when Firestore is empty', () => {
    const localLeads = [
      { id: 'local-1', personName: 'Local Candidate', status: 'contacted' }
    ];
    // Empty Firestore array must return the exact existing local array untouched
    expect(mergeLocalAndCloudRecords(localLeads, [])).toBe(localLeads);

    // Non-empty cloud result preserves local item with same ID and appends only net-new cloud IDs
    const hydratedLead = hydrateLeadFromFirestore({
      id: 'cloud-2',
      personName: 'Cloud Candidate',
      headline: 'Revenue Cycle Specialist',
      location: 'Minneapolis, MN',
      sourceType: 'Public LinkedIn Post',
      rawText: 'Need resume help',
      detectedCluster: 'healthcare_rcm',
      status: 'qualified',
      recommendedPackageId: 'revamp_99',
      notes: 'Bottleneck: Duty list | Gap: Needs metrics | Question: Target clinics?'
    });
    expect(hydratedLead.personName).toBe('Cloud Candidate');
    expect(hydratedLead.diagnosticBottleNeck).toBe('Duty list');
    expect(hydratedLead.dutyVsContributionGap).toBe('Needs metrics');
    expect(hydratedLead.diagnosticQuestionToAsk).toBe('Target clinics?');

    const merged = mergeLocalAndCloudRecords(localLeads as any[], [
      { id: 'local-1', personName: 'Older Cloud Copy', status: 'new_signal' } as any,
      hydratedLead
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].personName).toBe('Local Candidate');
    expect(merged[1].id).toBe('cloud-2');

    const hydratedRule = hydrateKeywordRuleFromFirestore({
      id: 'kw-cloud-1',
      phrase: 'medical billing',
      category: 'Healthcare RCM',
      weight: 30,
      rationale: 'Core target niche',
      enabled: true
    });
    expect(hydratedRule.clusterLabel).toBe('Healthcare RCM');
    expect(hydratedRule.weight).toBe(30);
  });
});
