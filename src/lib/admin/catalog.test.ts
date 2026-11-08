import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  listFunds,
  saveFundOrder,
  setFundActive,
  updateCampaign,
} from "@/lib/admin/catalog-queries";
import { campaignSchema } from "@/lib/admin/catalog-schema";
import { resolveActiveFunds } from "@/lib/fund-settings";

const DAY = 86_400_000;
let db: Db;

const campaign = (slug: string, overrides: Partial<typeof schema.campaigns.$inferInsert> = {}) => ({
  slug,
  goalCents: 100_000,
  startsAt: null,
  endsAt: null,
  ...overrides,
});

beforeEach(async () => {
  const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(testDb, { migrationsFolder: "drizzle" });
  db = testDb as unknown as Db;
});

const giveTo = async (campaignId: number, amountCents: number) => {
  const [fund] = await db
    .insert(schema.funds)
    .values({ slug: "general" })
    .onConflictDoUpdate({ target: schema.funds.slug, set: { slug: "general" } })
    .returning();
  const [donor] = await db
    .insert(schema.donors)
    .values({
      email: `d${amountCents}@example.com`,
      firstName: "Sam",
      lastName: "Lee",
      locale: "en",
    })
    .returning();
  await db.insert(schema.donations).values({
    donorId: donor!.id,
    fundId: fund!.id,
    campaignId,
    amountCents,
    frequency: "one_time",
    status: "succeeded",
    locale: "en",
  });
};

describe("campaigns", () => {
  it("lists what each campaign has raised and whether it's running", async () => {
    const now = Date.now();
    await createCampaign(db, campaign("live-one"));
    await createCampaign(db, campaign("later", { startsAt: new Date(now + 5 * DAY) }));
    await createCampaign(db, campaign("over", { endsAt: new Date(now - 5 * DAY) }));
    const [live] = await db.select().from(schema.campaigns).limit(1);
    await giveTo(live!.id, 2500);
    await giveTo(live!.id, 7500);

    const rows = await listCampaigns(db);
    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));
    expect(bySlug["live-one"]).toMatchObject({
      status: "live",
      raisedCents: 10_000,
      giftCount: 2,
      donorCount: 2,
    });
    expect(bySlug.later).toMatchObject({ status: "upcoming", raisedCents: 0, giftCount: 0 });
    expect(bySlug.over?.status).toBe("ended");
  });

  it("refuses a link name that's already used", async () => {
    await createCampaign(db, campaign("giving-day"));
    expect(await createCampaign(db, campaign("giving-day"))).toEqual({
      ok: false,
      error: "slugTaken",
    });
  });

  it("keeps the link and the campaign once gifts have come in", async () => {
    await createCampaign(db, campaign("giving-day"));
    const [row] = await db.select().from(schema.campaigns);
    await giveTo(row!.id, 5000);

    expect(await updateCampaign(db, row!.id, campaign("renamed"))).toEqual({
      ok: false,
      error: "hasGifts",
    });
    expect(await updateCampaign(db, row!.id, campaign("giving-day", { goalCents: 5 }))).toEqual({
      ok: true,
    });
    expect(await deleteCampaign(db, row!.id)).toEqual({ ok: false, error: "hasGifts" });
  });

  it("deletes a campaign with no gifts", async () => {
    await createCampaign(db, campaign("draft"));
    const [row] = await db.select().from(schema.campaigns);
    expect(await deleteCampaign(db, row!.id)).toEqual({ ok: true });
    expect(await listCampaigns(db)).toHaveLength(0);
  });

  it("validates the form", () => {
    const valid = { slug: " Giving-Day ", goal: "1,500", startsOn: "2026-11-01", endsOn: "" };
    expect(campaignSchema.parse(valid)).toEqual({
      slug: "giving-day",
      goal: 150_000,
      startsOn: "2026-11-01",
      endsOn: "",
    });
    expect(campaignSchema.safeParse({ ...valid, slug: "no spaces" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...valid, goal: "0" }).success).toBe(false);
    expect(
      campaignSchema.safeParse({ ...valid, startsOn: "2026-12-01", endsOn: "2026-11-01" }).success,
    ).toBe(false);
  });
});

describe("funds", () => {
  it("lists every fund in code order until an order is saved", async () => {
    const funds = await listFunds(db);
    expect(funds.map((fund) => fund.id)).toEqual(["general", "morale", "development", "community"]);
    expect(funds.every((fund) => fund.isActive)).toBe(true);
  });

  it("saves the order and hides funds that are turned off", async () => {
    await saveFundOrder(db, ["community", "general", "development", "morale"]);
    await setFundActive(db, "development", false);

    const funds = await listFunds(db);
    expect(funds.map((fund) => fund.id)).toEqual(["community", "general", "development", "morale"]);
    expect(funds.find((fund) => fund.id === "development")?.isActive).toBe(false);

    const rows = await db.select().from(schema.funds);
    expect(resolveActiveFunds(rows)).toEqual(["community", "general", "morale"]);
  });

  it("keeps at least one fund on", async () => {
    await setFundActive(db, "general", false);
    await setFundActive(db, "morale", false);
    await setFundActive(db, "development", false);
    expect(await setFundActive(db, "community", false)).toEqual({ ok: false, error: "lastFund" });
  });

  it("shows every fund if somehow all are off", () => {
    const rows = ["general", "morale", "development", "community"].map((slug, sortOrder) => ({
      slug,
      sortOrder,
      isActive: false,
    }));
    expect(resolveActiveFunds(rows)).toHaveLength(4);
  });
});
