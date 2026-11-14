import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

export interface RateLimitPolicy {
  hourlyIpLimit: number;
  dailyIpLimit: number;
  dailyGlobalLimit: number;
  monthlyGlobalLimit: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  reason?: string;
  scope?: 'ip_hourly' | 'ip_daily' | 'global_daily' | 'global_monthly' | 'distributed_store_required';
  retryAfterSeconds?: number;
  storageMode: 'distributed_firestore' | 'distributed_custom' | 'serialized_local_dev';
  counters?: {
    ipHourly: number;
    ipDaily: number;
    globalDaily: number;
    globalMonthly: number;
  };
}

export interface RateLimitStore {
  readonly mode: 'distributed_firestore' | 'distributed_custom' | 'serialized_local_dev';
  consumeQuota(params: {
    ipHash: string;
    buckets: {
      hourKey: string;
      dayKey: string;
      monthKey: string;
    };
    policy: RateLimitPolicy;
  }): Promise<RateLimitDecision>;
}

export function hashVisitorIp(rawIp: string | undefined, salt = process.env.RATE_LIMIT_SALT || 'purpose-glow-rl'): string {
  const normalized = (rawIp || 'unknown').split(',')[0].trim() || 'unknown';
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex').slice(0, 24);
}

export function buildTimeBuckets(now: Date = new Date()) {
  const iso = now.toISOString();
  const dayKey = iso.slice(0, 10); // YYYY-MM-DD
  const monthKey = iso.slice(0, 7); // YYYY-MM
  const hourKey = iso.slice(0, 13).replace('T', '_'); // YYYY-MM-DD_HH
  return { hourKey, dayKey, monthKey };
}

/**
 * Concurrency-safe local store that serializes every increment check through an
 * in-process promise queue so concurrent Promise.all bursts cannot race past caps.
 * Note: Single-instance only; multi-instance production should use FirestoreDistributedRateLimitStore
 * or Cloudflare Durable Objects.
 */
export class SerializedMemoryRateLimitStore implements RateLimitStore {
  readonly mode = 'serialized_local_dev' as const;
  private counts = new Map<string, number>();
  private queue: Promise<void> = Promise.resolve();

  async consumeQuota(params: {
    ipHash: string;
    buckets: { hourKey: string; dayKey: string; monthKey: string };
    policy: RateLimitPolicy;
  }): Promise<RateLimitDecision> {
    let result!: RateLimitDecision;

    const run = this.queue.then(() => {
      const { ipHash, buckets, policy } = params;
      const ipHrId = `ip_hr_${ipHash}_${buckets.hourKey}`;
      const ipDayId = `ip_day_${ipHash}_${buckets.dayKey}`;
      const globalDayId = `global_day_${buckets.dayKey}`;
      const globalMonthId = `global_month_${buckets.monthKey}`;

      const ipHourly = this.counts.get(ipHrId) || 0;
      const ipDaily = this.counts.get(ipDayId) || 0;
      const globalDaily = this.counts.get(globalDayId) || 0;
      const globalMonthly = this.counts.get(globalMonthId) || 0;

      if (globalMonthly >= policy.monthlyGlobalLimit) {
        result = {
          allowed: false,
          scope: 'global_monthly',
          reason: 'Monthly free AI assessment capacity reached. Personal human assessment and Tally registration remain open.',
          retryAfterSeconds: 86400,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
        return;
      }

      if (globalDaily >= policy.dailyGlobalLimit) {
        result = {
          allowed: false,
          scope: 'global_daily',
          reason: 'Daily free AI assessment capacity reached. Please try again tomorrow or request a personal review.',
          retryAfterSeconds: 3600,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
        return;
      }

      if (ipDaily >= policy.dailyIpLimit) {
        result = {
          allowed: false,
          scope: 'ip_daily',
          reason: `Daily limit of ${policy.dailyIpLimit} free AI assessments per visitor reached.`,
          retryAfterSeconds: 43200,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
        return;
      }

      if (ipHourly >= policy.hourlyIpLimit) {
        result = {
          allowed: false,
          scope: 'ip_hourly',
          reason: `Hourly limit of ${policy.hourlyIpLimit} free AI assessments per visitor reached. Please try again later.`,
          retryAfterSeconds: 1800,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
        return;
      }

      this.counts.set(ipHrId, ipHourly + 1);
      this.counts.set(ipDayId, ipDaily + 1);
      this.counts.set(globalDayId, globalDaily + 1);
      this.counts.set(globalMonthId, globalMonthly + 1);

      result = {
        allowed: true,
        storageMode: this.mode,
        counters: {
          ipHourly: ipHourly + 1,
          ipDaily: ipDaily + 1,
          globalDaily: globalDaily + 1,
          globalMonthly: globalMonthly + 1,
        },
      };
    });

    this.queue = run.catch(() => {});
    await run;
    return result;
  }
}

/**
 * Multi-instance distributed store backed by atomic Firestore transactions
 * on `/usageCounters/{counterId}` (strictly matching firestore.rules `UsageCounterRecord`).
 */
export class FirestoreDistributedRateLimitStore implements RateLimitStore {
  readonly mode = 'distributed_firestore' as const;
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async consumeQuota(params: {
    ipHash: string;
    buckets: { hourKey: string; dayKey: string; monthKey: string };
    policy: RateLimitPolicy;
  }): Promise<RateLimitDecision> {
    const { ipHash, buckets, policy } = params;
    const ipHrId = `ip_hr_${ipHash}_${buckets.hourKey}`;
    const ipDayId = `ip_day_${ipHash}_${buckets.dayKey}`;
    const globalDayId = `global_day_${buckets.dayKey}`;
    const globalMonthId = `global_month_${buckets.monthKey}`;

    return this.db.runTransaction(async (tx) => {
      const col = this.db.collection('usageCounters');
      const refs = [
        col.doc(ipHrId),
        col.doc(ipDayId),
        col.doc(globalDayId),
        col.doc(globalMonthId),
      ];

      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
      const ipHourly = Number(snaps[0].data()?.count || 0);
      const ipDaily = Number(snaps[1].data()?.count || 0);
      const globalDaily = Number(snaps[2].data()?.count || 0);
      const globalMonthly = Number(snaps[3].data()?.count || 0);

      if (globalMonthly >= policy.monthlyGlobalLimit) {
        return {
          allowed: false,
          scope: 'global_monthly',
          reason: 'Monthly free AI assessment capacity reached.',
          retryAfterSeconds: 86400,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
      }
      if (globalDaily >= policy.dailyGlobalLimit) {
        return {
          allowed: false,
          scope: 'global_daily',
          reason: 'Daily free AI assessment capacity reached.',
          retryAfterSeconds: 3600,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
      }
      if (ipDaily >= policy.dailyIpLimit) {
        return {
          allowed: false,
          scope: 'ip_daily',
          reason: `Daily limit of ${policy.dailyIpLimit} free AI assessments per visitor reached.`,
          retryAfterSeconds: 43200,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
      }
      if (ipHourly >= policy.hourlyIpLimit) {
        return {
          allowed: false,
          scope: 'ip_hourly',
          reason: `Hourly limit of ${policy.hourlyIpLimit} free AI assessments per visitor reached.`,
          retryAfterSeconds: 1800,
          storageMode: this.mode,
          counters: { ipHourly, ipDaily, globalDaily, globalMonthly },
        };
      }

      const nowIso = new Date().toISOString();
      const payloads = [
        { id: ipHrId, count: ipHourly + 1, limit: policy.hourlyIpLimit, updatedAt: nowIso },
        { id: ipDayId, count: ipDaily + 1, limit: policy.dailyIpLimit, updatedAt: nowIso },
        { id: globalDayId, count: globalDaily + 1, limit: policy.dailyGlobalLimit, updatedAt: nowIso },
        { id: globalMonthId, count: globalMonthly + 1, limit: policy.monthlyGlobalLimit, updatedAt: nowIso },
      ];

      refs.forEach((ref, idx) => {
        tx.set(ref, payloads[idx], { merge: true });
      });

      return {
        allowed: true,
        storageMode: this.mode,
        counters: {
          ipHourly: ipHourly + 1,
          ipDaily: ipDaily + 1,
          globalDaily: globalDaily + 1,
          globalMonthly: globalMonthly + 1,
        },
      };
    });
  }
}

export class PublicAssessmentRateLimiter {
  private store: RateLimitStore;
  private policy: RateLimitPolicy;
  private requireDistributedInProduction: boolean;

  constructor(options: {
    store?: RateLimitStore;
    policy: RateLimitPolicy;
    requireDistributedInProduction?: boolean;
  }) {
    this.store = options.store || new SerializedMemoryRateLimitStore();
    this.policy = options.policy;
    this.requireDistributedInProduction = options.requireDistributedInProduction ?? true;
  }

  getStorageMode() {
    return this.store.mode;
  }

  async checkAndConsume(params: {
    rawIp?: string;
    now?: Date;
    isProduction?: boolean;
  }): Promise<RateLimitDecision> {
    const isProd = params.isProduction ?? process.env.NODE_ENV === 'production';
    if (
      isProd &&
      this.requireDistributedInProduction &&
      this.store.mode === 'serialized_local_dev'
    ) {
      return {
        allowed: false,
        scope: 'distributed_store_required',
        reason:
          'Distributed multi-instance rate-limit store (Firestore Admin transaction or Cloudflare Durable Object) is required in production before enabling public AI.',
        retryAfterSeconds: 300,
        storageMode: this.store.mode,
      };
    }

    const ipHash = hashVisitorIp(params.rawIp);
    const buckets = buildTimeBuckets(params.now);
    return this.store.consumeQuota({
      ipHash,
      buckets,
      policy: this.policy,
    });
  }
}
