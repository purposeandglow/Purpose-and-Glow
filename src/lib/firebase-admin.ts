import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const firebaseConfig = require('../../firebase-applet-config.json');

export type RateLimitCredentialSource =
  | 'service_account_json'
  | 'application_default_file'
  | 'managed_service_account_adc'
  | 'local_dev_none';

export function getRateLimitCredentialSource(env: NodeJS.ProcessEnv = process.env): RateLimitCredentialSource {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    return 'service_account_json';
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return 'application_default_file';
  }
  const hasManagedRuntimeIdentity = Boolean(
    env.K_SERVICE || env.CLOUD_RUN_JOB || env.FUNCTION_TARGET || env.GOOGLE_CLOUD_PROJECT
  );
  if (
    env.RATE_LIMIT_BACKEND === 'firestore' ||
    (env.NODE_ENV === 'production' && hasManagedRuntimeIdentity && env.RATE_LIMIT_BACKEND !== 'memory')
  ) {
    return 'managed_service_account_adc';
  }
  return 'local_dev_none';
}

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(parsed),
        projectId: firebaseConfig.projectId,
      });
    } catch (err) {
      console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON; falling back to Application Default Credentials.', err);
      initializeApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    }
  } else {
    // Keyless Application Default Credentials (supports Cloud Run / App Hosting managed service-account identity
    // without generating or storing a long-lived service-account JSON key).
    initializeApp({
      credential: applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
  }
}

export const adminAuth = getAuth();

export function getAdminFirestoreForRateLimit(env: NodeJS.ProcessEnv = process.env): Firestore | null {
  const credSource = getRateLimitCredentialSource(env);
  if (credSource === 'local_dev_none') {
    return null;
  }
  const dbId = firebaseConfig.firestoreDatabaseId;
  return dbId && dbId !== '(default)' ? getFirestore(undefined as any, dbId) : getFirestore();
}

export function getAdminFirestoreForInquiries(env: NodeJS.ProcessEnv = process.env): Firestore | null {
  // Never connect to live Firestore automatically inside unit tests unless explicitly injected
  if (env.VITEST === 'true' && env.INQUIRIES_STORAGE_BACKEND !== 'firestore') {
    return null;
  }

  const hasExplicitCreds = Boolean(
    env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      env.FIRESTORE_EMULATOR_HOST?.trim()
  );
  const hasManagedRuntimeIdentity = Boolean(
    env.K_SERVICE || env.CLOUD_RUN_JOB || env.FUNCTION_TARGET || env.GOOGLE_CLOUD_PROJECT
  );
  const forceMemory = env.INQUIRIES_STORAGE_BACKEND === 'memory';
  const forceFirestore = env.INQUIRIES_STORAGE_BACKEND === 'firestore';

  if (forceMemory && !forceFirestore) {
    return null;
  }

  // Only auto-connect managed runtime ADC in production (matching getRateLimitCredentialSource),
  // so cross-project dev containers (e.g., K_SERVICE in development) default safely to memory
  // unless explicit credentials or INQUIRIES_STORAGE_BACKEND=firestore are configured.
  if (
    hasExplicitCreds ||
    forceFirestore ||
    (env.NODE_ENV === 'production' && hasManagedRuntimeIdentity) ||
    env.NODE_ENV === 'production'
  ) {
    const dbId = firebaseConfig.firestoreDatabaseId;
    return dbId && dbId !== '(default)' ? getFirestore(undefined as any, dbId) : getFirestore();
  }

  return null;
}

export async function probeFirestoreRateLimitConnectivity(
  db: Firestore | null = getAdminFirestoreForRateLimit()
): Promise<{ reachable: boolean; credentialSource: RateLimitCredentialSource; error?: string }> {
  const credentialSource = getRateLimitCredentialSource();
  if (!db) {
    return {
      reachable: false,
      credentialSource,
      error: 'Distributed Firestore rate-limit backend is not enabled in local dev mode.',
    };
  }
  try {
    await db.collection('usageCounters').doc('_adc_health_probe').get();
    return { reachable: true, credentialSource };
  } catch (err: unknown) {
    return {
      reachable: false,
      credentialSource,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
