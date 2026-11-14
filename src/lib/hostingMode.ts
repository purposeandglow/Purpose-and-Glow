export const TALLY_REGISTRATION_URL = 'https://tally.so/r/q5a1RY';
export const CALENDLY_CONSULTATION_URL =
  'https://calendly.com/purposeandglowcareers/career-consultation';
export const GOOGLE_INTAKE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSc3Yytk2ylUnjF3AUh3NnelWCoBAym-iH-n_k1LWQlNhBa62A/viewform';
export const BUSINESS_CONTACT_EMAIL = 'purposeandglowcareers@gmail.com';

export interface StaticModeEnvInput {
  viteStaticHosting?: string;
  viteBackendApiEnabled?: string;
  hostname?: string;
}

/**
 * Determines whether the frontend is running on static-only hosting (e.g. Firebase Hosting
 * `.web.app` / `.firebaseapp.com` or `VITE_STATIC_HOSTING=true`) without the Express backend.
 */
export function isStaticHostingMode(input?: StaticModeEnvInput): boolean {
  const viteStatic =
    input?.viteStaticHosting ??
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_STATIC_HOSTING);
  const viteBackendEnabled =
    input?.viteBackendApiEnabled ??
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_API_ENABLED);

  if (viteBackendEnabled === 'true') {
    return false;
  }
  if (viteStatic === 'true') {
    return true;
  }

  const hostname =
    input?.hostname ??
    (typeof window !== 'undefined' && window.location ? window.location.hostname : '');

  if (/(\.web\.app|\.firebaseapp\.com|\.pages\.dev|\.netlify\.app)$/i.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * Safely parses a JSON backend API response and rejects HTML SPA fallbacks returned with HTTP 200.
 */
export async function parseJsonApiResponse<T = Record<string, any>>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T | null; isHtmlFallback: boolean }> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      status: res.status,
      data: null,
      isHtmlFallback: contentType.includes('text/html') || res.status === 200,
    };
  }

  const data = (await res.json().catch(() => null)) as T | null;
  return {
    ok: res.ok && data !== null,
    status: res.status,
    data,
    isHtmlFallback: false,
  };
}
