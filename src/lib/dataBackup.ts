export const BACKUP_SCHEMA_VERSION = '1.0.0';

export interface BackupCounts {
  leads: number;
  keywordRules: number;
  notifications: number;
  clientRequests: number;
  serverInquiries: number;
  serverLeads: number;
  serverChatMessages: number;
}

export interface ServerBackupSnapshot {
  capturedAt: string;
  postgresConfigured: boolean;
  postgresReachable: boolean;
  inquiries: any[];
  leads: any[];
  chatMessages: any[];
  users: any[];
  warning?: string;
}

export interface PurposeGlowBackupBundle {
  schemaVersion: string;
  exportedAt: string;
  sourceApp: string;
  counts: BackupCounts;
  browserData: {
    leads: any[];
    keywordRules: any[];
    notifications: any[];
    clientRequests: Record<string, any>;
    theme: string | null;
  };
  serverSnapshot: ServerBackupSnapshot | null;
  checksumSha256: string;
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function computePayloadChecksum(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  try {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const bytes = new TextEncoder().encode(text);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback deterministic FNV-1a hex if subtle crypto unavailable
  }

  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export interface StorageLike {
  getItem(key: string): string | null;
}

export async function buildClientDataBackup(
  storage: StorageLike | null = typeof window !== 'undefined' ? window.localStorage : null,
  serverSnapshot: ServerBackupSnapshot | null = null
): Promise<PurposeGlowBackupBundle> {
  const leadsRaw = storage ? safeParseJson<any[]>(storage.getItem('pg_lead_signals'), []) : [];
  const rulesRaw = storage ? safeParseJson<any[]>(storage.getItem('pg_keyword_rules'), []) : [];
  const notificationsRaw = storage ? safeParseJson<any[]>(storage.getItem('pg_admin_notifications'), []) : [];
  const clientRequestsLegacyRaw = storage ? safeParseJson<Record<string, any>>(storage.getItem('pg_reqs_v2'), {}) : {};
  const clientRequestsActiveRaw = storage ? safeParseJson<Record<string, any>>(storage.getItem('pg_client_requests'), {}) : {};
  const theme = storage ? storage.getItem('pg_theme') : null;

  const leads = Array.isArray(leadsRaw) ? leadsRaw : [];
  const keywordRules = Array.isArray(rulesRaw) ? rulesRaw : [];
  const notifications = Array.isArray(notificationsRaw) ? notificationsRaw : [];
  const clientRequests = {
    ...(clientRequestsLegacyRaw && typeof clientRequestsLegacyRaw === 'object' && !Array.isArray(clientRequestsLegacyRaw)
      ? clientRequestsLegacyRaw
      : {}),
    ...(clientRequestsActiveRaw && typeof clientRequestsActiveRaw === 'object' && !Array.isArray(clientRequestsActiveRaw)
      ? clientRequestsActiveRaw
      : {})
  };

  const browserData = {
    leads,
    keywordRules,
    notifications,
    clientRequests,
    theme,
  };

  const counts: BackupCounts = {
    leads: leads.length,
    keywordRules: keywordRules.length,
    notifications: notifications.length,
    clientRequests: Object.keys(clientRequests).length,
    serverInquiries: serverSnapshot?.inquiries?.length || 0,
    serverLeads: serverSnapshot?.leads?.length || 0,
    serverChatMessages: serverSnapshot?.chatMessages?.length || 0,
  };

  const checksumSha256 = await computePayloadChecksum({ browserData, serverSnapshot, counts });

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sourceApp: 'Purpose & Glow Career Solutions',
    counts,
    browserData,
    serverSnapshot,
    checksumSha256,
  };
}

export async function validateBackupBundle(
  bundle: PurposeGlowBackupBundle
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  if (!bundle || typeof bundle !== 'object') {
    return { valid: false, errors: ['Backup bundle is not an object'] };
  }
  if (bundle.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${bundle.schemaVersion}`);
  }
  if (!Array.isArray(bundle.browserData?.leads)) {
    errors.push('browserData.leads must be an array');
  }
  if (!Array.isArray(bundle.browserData?.keywordRules)) {
    errors.push('browserData.keywordRules must be an array');
  }
  if (!Array.isArray(bundle.browserData?.notifications)) {
    errors.push('browserData.notifications must be an array');
  }
  if (
    !bundle.browserData?.clientRequests ||
    typeof bundle.browserData.clientRequests !== 'object' ||
    Array.isArray(bundle.browserData.clientRequests)
  ) {
    errors.push('browserData.clientRequests must be a record object');
  }

  const expectedChecksum = await computePayloadChecksum({
    browserData: bundle.browserData,
    serverSnapshot: bundle.serverSnapshot,
    counts: bundle.counts,
  });

  if (expectedChecksum !== bundle.checksumSha256) {
    errors.push('Checksum mismatch: backup integrity check failed');
  }

  return { valid: errors.length === 0, errors };
}

export function triggerBackupDownload(bundle: PurposeGlowBackupBundle): string {
  const dateStamp = bundle.exportedAt.slice(0, 10);
  const filename = `purpose-glow-backup-${dateStamp}.json`;
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export interface StorageReadWriteLike extends StorageLike {
  setItem(key: string, value: string): void;
}

function mergeArrayById<T extends { id?: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    if (item && typeof item === 'object' && item.id) {
      map.set(String(item.id), item);
    }
  }
  for (const item of incoming) {
    if (item && typeof item === 'object' && item.id && !map.has(String(item.id))) {
      map.set(String(item.id), item);
    }
  }
  return Array.from(map.values());
}

export async function restoreClientDataBackup(
  bundle: PurposeGlowBackupBundle,
  storage: StorageReadWriteLike | null = typeof window !== 'undefined' ? window.localStorage : null
): Promise<{
  restored: boolean;
  errors: string[];
  mergedCounts: {
    leads: number;
    keywordRules: number;
    notifications: number;
    clientRequests: number;
  };
}> {
  const validation = await validateBackupBundle(bundle);
  if (!validation.valid) {
    return {
      restored: false,
      errors: validation.errors,
      mergedCounts: { leads: 0, keywordRules: 0, notifications: 0, clientRequests: 0 },
    };
  }

  const currentLeads = storage ? safeParseJson<any[]>(storage.getItem('pg_lead_signals'), []) : [];
  const currentRules = storage ? safeParseJson<any[]>(storage.getItem('pg_keyword_rules'), []) : [];
  const currentNotifications = storage
    ? safeParseJson<any[]>(storage.getItem('pg_admin_notifications'), [])
    : [];
  const currentRequestsLegacy = storage
    ? safeParseJson<Record<string, any>>(storage.getItem('pg_reqs_v2'), {})
    : {};
  const currentRequestsActive = storage
    ? safeParseJson<Record<string, any>>(storage.getItem('pg_client_requests'), {})
    : {};

  const mergedLeads = mergeArrayById(
    Array.isArray(currentLeads) ? currentLeads : [],
    bundle.browserData.leads
  );
  const mergedRules = mergeArrayById(
    Array.isArray(currentRules) ? currentRules : [],
    bundle.browserData.keywordRules
  );
  const mergedNotifications = mergeArrayById(
    Array.isArray(currentNotifications) ? currentNotifications : [],
    bundle.browserData.notifications
  );
  const mergedRequests = {
    ...bundle.browserData.clientRequests,
    ...(currentRequestsLegacy && typeof currentRequestsLegacy === 'object' ? currentRequestsLegacy : {}),
    ...(currentRequestsActive && typeof currentRequestsActive === 'object' ? currentRequestsActive : {}),
  };

  if (storage) {
    storage.setItem('pg_lead_signals', JSON.stringify(mergedLeads));
    storage.setItem('pg_keyword_rules', JSON.stringify(mergedRules));
    storage.setItem('pg_admin_notifications', JSON.stringify(mergedNotifications));
    storage.setItem('pg_reqs_v2', JSON.stringify(mergedRequests));
    storage.setItem('pg_client_requests', JSON.stringify(mergedRequests));
  }

  return {
    restored: true,
    errors: [],
    mergedCounts: {
      leads: mergedLeads.length,
      keywordRules: mergedRules.length,
      notifications: mergedNotifications.length,
      clientRequests: Object.keys(mergedRequests).length,
    },
  };
}

