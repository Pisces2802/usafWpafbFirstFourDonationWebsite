import "server-only";

import { createHash } from "node:crypto";

import { lt, sql } from "drizzle-orm";

import { type Db, getDb } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimit = { limit: number; windowMs: number };

const hits = new Map<string, number[]>();

/**
 * Sliding-window limiter kept in memory. It only sees requests that reach this server instance,
 * so it's the fallback for when there's no database, not the main limiter.
 */
export const isRateLimitedInMemory = (key: string, { limit, windowMs }: RateLimit) => {
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

/** Roughly one call in this many also clears out closed windows. */
const PRUNE_EVERY = 100;

/**
 * Counts one request against `key` in the database and returns the count for the current window.
 * Windows are fixed (they start on multiples of `windowMs`), which lets a burst straddling two
 * windows reach up to twice the limit; that's fine for slowing down form abuse.
 */
export const recordHit = async (db: Db, key: string, windowMs: number, now = new Date()) => {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const keyHash = createHash("sha256").update(key).digest("hex");

  const [row] = await db
    .insert(rateLimits)
    .values({ keyHash, windowStart, expiresAt: new Date(windowStart.getTime() + windowMs) })
    .onConflictDoUpdate({
      target: [rateLimits.keyHash, rateLimits.windowStart],
      set: { hits: sql`${rateLimits.hits} + 1` },
    })
    .returning({ hits: rateLimits.hits });

  if (Math.random() * PRUNE_EVERY < 1) {
    await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now));
  }

  return row.hits;
};

/**
 * Whether `key` has had more than `limit` requests in the current window. Counts are kept in
 * Postgres, so every server instance (and every serverless invocation) shares them. Without a
 * database, or if the query fails, it falls back to this instance's memory rather than blocking
 * people or failing the request.
 */
export const isRateLimited = async (key: string, options: RateLimit) => {
  const db = getDb();
  if (!db) return isRateLimitedInMemory(key, options);

  try {
    return (await recordHit(db, key, options.windowMs)) > options.limit;
  } catch (error) {
    console.error("Rate limit check failed; using this instance's memory", error);
    return isRateLimitedInMemory(key, options);
  }
};

/** Best-effort client IP from proxy headers. */
export const getClientIp = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
