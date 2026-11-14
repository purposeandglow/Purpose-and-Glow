import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRequireAdminAuth, type AuthRequest } from '../src/middleware/auth.ts';
import { getGeminiRuntimeConfig, DEFAULT_PUBLIC_GEMINI_MODEL, DEFAULT_ADMIN_GEMINI_MODEL } from '../src/lib/geminiConfig.ts';
import { buildClientDataBackup, validateBackupBundle } from '../src/lib/dataBackup.ts';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

describe('Phase 1 Security Foundation: requireAdminAuth', () => {
  it('rejects requests without Authorization Bearer header with 401', async () => {
    const middleware = createRequireAdminAuth(async () => {
      throw new Error('Should not verify');
    });
    const req = { headers: {} } as AuthRequest;
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired Firebase tokens with 401', async () => {
    const middleware = createRequireAdminAuth(async () => {
      throw new Error('Token expired');
    });
    const req = { headers: { authorization: 'Bearer bad.jwt.token' } } as AuthRequest;
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects spoofed admin email when email_verified is false (403)', async () => {
    const middleware = createRequireAdminAuth(async () => ({
      uid: 'uid-spoof',
      email: 'purposeandglowcareers@gmail.com',
      email_verified: false,
    } as any));
    const req = { headers: { authorization: 'Bearer spoof.token' } } as AuthRequest;
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects verified non-admin Google accounts with 403', async () => {
    const middleware = createRequireAdminAuth(async () => ({
      uid: 'uid-attacker',
      email: 'randomuser@gmail.com',
      email_verified: true,
    } as any));
    const req = { headers: { authorization: 'Bearer valid.nonadmin.token' } } as AuthRequest;
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('permits verified allowlisted founder account (200 / next())', async () => {
    const middleware = createRequireAdminAuth(async () => ({
      uid: 'uid-founder',
      email: 'purposeandglowcareers@gmail.com',
      email_verified: true,
    } as any));
    const req = { headers: { authorization: 'Bearer valid.founder.token' } } as AuthRequest;
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.uid).toBe('uid-founder');
  });
});

describe('Phase 1 Gemini Runtime Configuration', () => {
  it('defaults PUBLIC_AI_ENABLED to false and sets verified default model names', () => {
    const cfg = getGeminiRuntimeConfig({} as NodeJS.ProcessEnv);
    expect(cfg.publicAiEnabled).toBe(false);
    expect(cfg.publicModel).toBe(DEFAULT_PUBLIC_GEMINI_MODEL);
    expect(cfg.adminModel).toBe(DEFAULT_ADMIN_GEMINI_MODEL);
    expect(cfg.limits.hourlyIpLimit).toBe(3);
    expect(cfg.limits.dailyIpLimit).toBe(5);
    expect(cfg.limits.dailyGlobalLimit).toBe(100);
    expect(cfg.limits.monthlyGlobalLimit).toBe(2000);
  });

  it('only enables public AI when PUBLIC_AI_ENABLED is strictly "true"', () => {
    expect(getGeminiRuntimeConfig({ PUBLIC_AI_ENABLED: '1' } as any).publicAiEnabled).toBe(false);
    expect(getGeminiRuntimeConfig({ PUBLIC_AI_ENABLED: 'true' } as any).publicAiEnabled).toBe(true);
  });
});

describe('Phase 1 Existing Data Backup & Checksum Validation', () => {
  it('exports existing localStorage leads, rules, notifications, and requests cleanly with checksum validation', async () => {
    const store: Record<string, string> = {
      pg_lead_signals: JSON.stringify([{ id: 'lead-1', personName: 'Jane Doe' }]),
      pg_keyword_rules: JSON.stringify([{ id: 'rule-1', phrase: 'rcm', weight: 20 }]),
      pg_admin_notifications: JSON.stringify([{ id: 'notif-1', senderName: 'Alex' }]),
      pg_reqs_v2: JSON.stringify({ req1: { id: 'req1', first: 'Sam', email: 'sam@example.com' } }),
      pg_theme: 'light',
    };
    const mockStorage = {
      getItem: (k: string) => store[k] ?? null,
    };

    const bundle = await buildClientDataBackup(mockStorage, null);
    expect(bundle.counts.leads).toBe(1);
    expect(bundle.counts.keywordRules).toBe(1);
    expect(bundle.counts.notifications).toBe(1);
    expect(bundle.counts.clientRequests).toBe(1);

    const validation = await validateBackupBundle(bundle);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    // Detect tampering
    bundle.browserData.leads.push({ id: 'tampered' });
    const tamperedValidation = await validateBackupBundle(bundle);
    expect(tamperedValidation.valid).toBe(false);
  });

  it('recovers safely when localStorage contains malformed JSON', async () => {
    const brokenStorage = {
      getItem: (k: string) => (k === 'pg_lead_signals' ? '{corrupt_json' : null),
    };
    const bundle = await buildClientDataBackup(brokenStorage, null);
    expect(bundle.counts.leads).toBe(0);
    const validation = await validateBackupBundle(bundle);
    expect(validation.valid).toBe(true);
  });
});
