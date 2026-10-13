interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSeconds: number } {
  const bucket = buckets.get(key) ?? { hits: [] };
  const fresh = bucket.hits.filter((hit) => now - hit < windowMs);
  if (fresh.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - fresh[0])) / 1000));
    buckets.set(key, { hits: fresh });
    return { ok: false, retryAfterSeconds };
  }
  fresh.push(now);
  buckets.set(key, { hits: fresh });
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}
