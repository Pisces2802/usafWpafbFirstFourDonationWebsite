import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import {
  loadActiveCampaignProgress,
  loadCampaignProgress,
  toCacheMinute,
} from "@/lib/campaign-progress";

const DAY = 86_400_000;
const NOW = new Date("2026-11-13T12:00:00Z");
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY);

let db: Db;

beforeEach(async () => {
  const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(testDb, { migrationsFolder: "drizzle" });
  db = testDb as unknown as Db;
});

const addCampaign = async (
  slug: string,
  dates: { startsAt?: Date | null; endsAt?: Date | null } = {},
) => {
  const [row] = await db
    .insert(schema.campaigns)
    .values({ slug, goalCents: 100_000, startsAt: null, endsAt: null, ...dates })
    .returning();
  return row!;
};

const give = async (
  campaignId: number,
  donorEmail: string,
  gift: Partial<typeof schema.donations.$inferInsert> & { amountCents: number },
) => {
  const [fund] = await db
    .insert(schema.funds)
    .values({ slug: "general" })
    .onConflictDoUpdate({ target: schema.funds.slug, set: { slug: "general" } })
    .returning();
  const [donor] = await db
    .insert(schema.donors)
    .values({ email: donorEmail, firstName: "Sam", lastName: "Lee", locale: "en" })
    .onConflictDoUpdate({ target: schema.donors.email, set: { locale: "en" } })
    .returning();
  await db.insert(schema.donations).values({
    donorId: donor!.id,
    fundId: fund!.id,
    campaignId,
    frequency: "one_time",
    status: "succeeded",
    locale: "en",
    ...gift,
  });
};

describe("loadCampaignProgress", () => {
  it("totals gifts net of refunds, counting each donor once", async () => {
    const spring = await addCampaign("spring");
    const other = await addCampaign("other");

    await give(spring.id, "a@example.com", { amountCents: 5000 });
    await give(spring.id, "a@example.com", { amountCents: 2500 });
    await give(spring.id, "b@example.com", {
      amountCents: 10_000,
      status: "refunded",
      refundedCents: 4000,
    });
    await give(spring.id, "c@example.com", { amountCents: 9999, status: "failed" });
    await give(other.id, "d@example.com", { amountCents: 70_000 });

    expect(await loadCampaignProgress(db, "spring")).toEqual({
      raisedCents: 5000 + 2500 + 6000,
      goalCents: 100_000,
      donorCount: 2,
    });
  });

  it("never lets a refund push a gift below zero", async () => {
    const spring = await addCampaign("spring");
    await give(spring.id, "a@example.com", {
      amountCents: 5000,
      status: "refunded",
      refundedCents: 6000,
    });

    expect((await loadCampaignProgress(db, "spring"))?.raisedCents).toBe(0);
  });

  it("is null for an unknown campaign and zero for one with no gifts", async () => {
    await addCampaign("quiet");

    expect(await loadCampaignProgress(db, "missing")).toBeNull();
    expect(await loadCampaignProgress(db, "quiet")).toEqual({
      raisedCents: 0,
      goalCents: 100_000,
      donorCount: 0,
    });
  });
});

describe("loadActiveCampaignProgress", () => {
  it("ignores campaigns that haven't started or have ended", async () => {
    await addCampaign("past", { startsAt: daysFromNow(-30), endsAt: daysFromNow(-1) });
    await addCampaign("future", { startsAt: daysFromNow(1) });

    expect(await loadActiveCampaignProgress(db, NOW)).toBeNull();
  });

  it("picks the most recently started of overlapping campaigns, over open-ended ones", async () => {
    await addCampaign("always");
    await addCampaign("older", { startsAt: daysFromNow(-20), endsAt: daysFromNow(10) });
    await addCampaign("newer", { startsAt: daysFromNow(-2) });

    expect((await loadActiveCampaignProgress(db, NOW))?.slug).toBe("newer");
  });

  it("falls back to an open-ended campaign", async () => {
    await addCampaign("always");

    expect(await loadActiveCampaignProgress(db, NOW)).toMatchObject({
      slug: "always",
      raisedCents: 0,
    });
  });
});

describe("toCacheMinute", () => {
  it("gives every moment in the same minute the same key", () => {
    expect(toCacheMinute(new Date("2026-11-13T12:34:00.000Z"))).toBe("2026-11-13T12:34:00.000Z");
    expect(toCacheMinute(new Date("2026-11-13T12:34:59.999Z"))).toBe("2026-11-13T12:34:00.000Z");
    expect(toCacheMinute(new Date("2026-11-13T12:35:00.000Z"))).toBe("2026-11-13T12:35:00.000Z");
  });
});
