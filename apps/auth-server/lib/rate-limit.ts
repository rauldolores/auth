/**
 * Minimal, dependency-free, in-memory sliding-window rate limiter.
 *
 * Deliberately NOT backed by Redis/Upstash/a KV store — this project has no
 * such infra today, and adding one just for this would be a bigger decision
 * than a rate-limit check warrants. The honest tradeoff: this only works
 * within a single long-running process. On a self-hosted Docker deployment
 * (this project's own docker-compose.yml runs auth-server as one
 * long-running Node process) it's fully effective. On a serverless target
 * (Vercel etc., also a supported CLI deploy option) each invocation may get
 * a fresh instance with its own counters, so the limit becomes "per warm
 * instance" rather than truly global — degrades to no-op in the worst case,
 * never to a false rejection of legitimate traffic. Treat this as the same
 * kind of best-effort, clearly-scoped mitigation as GOTRUE_RATE_LIMIT_HEADER
 * in docker/docker-compose.yml, not a guarantee.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
let checksSinceSweep = 0;

/** Drops buckets with no hits inside the last hour — bounds memory from
 * many distinct keys (e.g. many source IPs) without needing a timer. */
function sweep() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0 || bucket.timestamps[bucket.timestamps.length - 1]! < cutoff) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest request in the current window ages out. */
  retryAfterSeconds: number;
}

/** Test-only: the module-level bucket map is otherwise a singleton for the
 * lifetime of the process, which would let one test's requests bleed into
 * another's rate-limit budget. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
  checksSinceSweep = 0;
}

export function checkRateLimit(key: string, opts: { max: number; windowMs: number }): RateLimitResult {
  checksSinceSweep += 1;
  if (checksSinceSweep >= 1000) {
    checksSinceSweep = 0;
    sweep();
  }

  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= opts.max) {
    buckets.set(key, bucket);
    const retryAfterMs = bucket.timestamps[0]! + opts.windowMs - now;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}
