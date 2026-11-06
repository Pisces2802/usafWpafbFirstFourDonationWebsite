import "server-only";

const hits = new Map<string, number[]>();

/**
 * Fixed-size sliding-window limiter kept in memory. It only sees requests that reach this server
 * instance, so on serverless hosting it's a speed bump, not a guarantee; Turnstile is the main gate.
 */
export const isRateLimited = (
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
) => {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 10_000) {
    for (const [entryKey, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(entryKey);
    }
  }

  return false;
};

/** Best-effort client IP from proxy headers. */
export const getClientIp = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
