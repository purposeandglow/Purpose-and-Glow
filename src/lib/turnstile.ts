export interface TurnstileVerificationResult {
  configured: boolean;
  verified: boolean;
  reason?: string;
}

export function isTurnstileConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.TURNSTILE_SECRET_KEY &&
      env.TURNSTILE_SECRET_KEY.trim().length > 0 &&
      env.TURNSTILE_SITE_KEY &&
      env.TURNSTILE_SITE_KEY.trim().length > 0
  );
}

/**
 * Verifies a Cloudflare Turnstile response token server-side via siteverify.
 * When TURNSTILE_SECRET_KEY is configured, missing or invalid tokens fail closed.
 * When unconfigured (local dev before launch), reports configured: false so callers
 * can still test safely while keeping PUBLIC_AI_ENABLED=false for public visitors.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerificationResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return {
      configured: false,
      verified: false,
      reason: 'TURNSTILE_SECRET_KEY is not configured yet.',
    };
  }

  if (!token || !token.trim()) {
    return {
      configured: true,
      verified: false,
      reason: 'Bot verification challenge token is required.',
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.set('secret', secret);
    formData.set('response', token.trim());
    if (remoteIp) {
      formData.set('remoteip', remoteIp);
    }

    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        configured: true,
        verified: false,
        reason: `Turnstile verification service returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data.success === true) {
      return { configured: true, verified: true };
    }

    return {
      configured: true,
      verified: false,
      reason:
        Array.isArray(data['error-codes']) && data['error-codes'].length > 0
          ? `Turnstile verification rejected (${data['error-codes'].join(', ')})`
          : 'Turnstile challenge failed.',
    };
  } catch (err: unknown) {
    return {
      configured: true,
      verified: false,
      reason: err instanceof Error ? err.message : 'Turnstile verification error',
    };
  }
}
