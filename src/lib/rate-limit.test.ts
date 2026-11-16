import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { isRateLimitedInMemory, recordHit } from "@/lib/rate-limit";

const MINUTE = 60_000;
const NOW = new Date("2026-11-15T12:00:30Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("recordHit", () => {
  let db: Db;

  beforeEach(async () => {
    const pglite = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(pglite, { migrationsFolder: "drizzle" });
    db = pglite as unknown as Db;
  });

  it("counts hits per key within a window", async () => {
    expect(await recordHit(db, "form:1.2.3.4", MINUTE, NOW)).toBe(1);
    expect(await recordHit(db, "form:1.2.3.4", MINUTE, later(10_000))).toBe(2);
    expect(await recordHit(db, "form:5.6.7.8", MINUTE, later(10_000))).toBe(1);
  });

  it("starts again in the next window", async () => {
    await recordHit(db, "form:1.2.3.4", MINUTE, NOW);
    await recordHit(db, "form:1.2.3.4", MINUTE, NOW);
    expect(await recordHit(db, "form:1.2.3.4", MINUTE, later(MINUTE))).toBe(1);
  });

  it("stores a hash of the key, never the key itself", async () => {
    await recordHit(db, "form:1.2.3.4", MINUTE, NOW);
    const [row] = await db.select().from(schema.rateLimits);

    expect(row.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.keyHash).not.toContain("1.2.3.4");
    expect(row.windowStart).toEqual(new Date("2026-11-15T12:00:00Z"));
    expect(row.expiresAt).toEqual(new Date("2026-11-15T12:01:00Z"));
  });

  it("clears closed windows when it prunes", async () => {
    await recordHit(db, "old", MINUTE, NOW);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    await recordHit(db, "new", MINUTE, later(5 * MINUTE));
    random.mockRestore();

    const rows = await db.select().from(schema.rateLimits);
    expect(rows).toHaveLength(1);
  });
});

describe("isRateLimitedInMemory", () => {
  it("allows `limit` requests, then blocks until the window passes", () => {
    vi.useFakeTimers({ now: NOW });
    const key = `memory-test:${Math.random()}`;
    const options = { limit: 2, windowMs: MINUTE };

    expect(isRateLimitedInMemory(key, options)).toBe(false);
    expect(isRateLimitedInMemory(key, options)).toBe(false);
    expect(isRateLimitedInMemory(key, options)).toBe(true);

    vi.advanceTimersByTime(MINUTE);
    expect(isRateLimitedInMemory(key, options)).toBe(false);
    vi.useRealTimers();
  });
});
