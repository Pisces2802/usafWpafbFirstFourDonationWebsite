import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  listFunds,
  reviewCampaign,
  saveFundOrder,
  setFundActive,
  updateCampaign,
} from "@/lib/admin/catalog-queries";
import { campaignSchema } from "@/lib/admin/catalog-schema";
import { resolveActiveFunds } from "@/lib/fund-settings";

const DAY = 86_400_000;
let db: Db;
/** Two people, since a campaign needs one to ask and another to approve. */
let maker: number;
let checker: number;

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
  const [role] = await db.select({ id: schema.adminRoles.id }).from(schema.adminRoles).limit(1);
  const people = await db
    .insert(schema.adminUsers)
    .values(
      ["maker", "checker", "third"].map((name) => ({
        name,
        email: `${name}@example.com`,
        roleId: role!.id,
      })),
    )
    .returning({ id: schema.adminUsers.id });
  [maker, checker] = people.map((person) => person.id) as [number, number];
});

const create = (values: ReturnType<typeof campaign>, by = maker) => createCampaign(db, values, by);
const update = (id: number, values: ReturnType<typeof campaign>, by = maker) =>
  updateCampaign(db, id, values, by);

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
    await create(campaign("live-one"));
    await create(campaign("later", { startsAt: new Date(now + 5 * DAY) }));
    await create(campaign("over", { endsAt: new Date(now - 5 * DAY) }));
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
    await create(campaign("giving-day"));
    expect(await create(campaign("giving-day"))).toEqual({
      ok: false,
      error: "slugTaken",
    });
  });

  it("keeps the link and the campaign once gifts have come in", async () => {
    await create(campaign("giving-day"));
    const [row] = await db.select().from(schema.campaigns);
    await giveTo(row!.id, 5000);

    expect(await update(row!.id, campaign("renamed"))).toEqual({
      ok: false,
      error: "hasGifts",
    });
    expect(await update(row!.id, campaign("giving-day", { goalCents: 5 }))).toEqual({
      ok: true,
      asked: "new",
    });
    expect(await deleteCampaign(db, row!.id)).toEqual({ ok: false, error: "hasGifts" });
  });

  it("deletes a campaign with no gifts", async () => {
    await create(campaign("draft"));
    const [row] = await db.select().from(schema.campaigns);
    expect(await deleteCampaign(db, row!.id)).toEqual({ ok: true });
    expect(await listCampaigns(db)).toHaveLength(0);
  });

  describe("approval", () => {
    const only = async () => (await db.select().from(schema.campaigns))[0]!;
    /** Reviews what's waiting, as last seen unless `seenAt` says otherwise. */
    const review = async (
      id: number,
      reviewerId: number,
      approve = true,
      note: string | null = null,
      seenAt?: Date | null,
    ) => {
      const [row] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
      const seen =
        seenAt !== undefined
          ? seenAt
          : ((row?.approval === "pending" ? row.requestedAt : row?.changeRequestedAt) ?? null);
      const result = await reviewCampaign(db, id, { reviewerId, approve, note, seenAt: seen });
      return result.ok ? { ok: true } : result;
    };
    const approved = async (slug = "giving-day") => {
      await create(campaign(slug, { goalCents: 100_000 }));
      const { id } = await only();
      await review(id, checker);
      return id;
    };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

    it("waits for approval, and only someone else can approve it", async () => {
      await create(campaign("giving-day"));
      const row = await only();
      expect(row).toMatchObject({ approval: "pending", createdById: maker, requestedById: maker });

      expect(await review(row.id, maker)).toEqual({ ok: false, error: "ownCampaign" });
      expect(await review(row.id, maker, false)).toEqual({ ok: false, error: "ownCampaign" });
      expect((await only()).approval).toBe("pending");

      expect(await review(row.id, checker)).toEqual({ ok: true });
      expect(await only()).toMatchObject({ approval: "approved", reviewedById: checker });
      expect(await review(row.id, checker)).toEqual({ ok: false, error: "notPending" });
      expect(await review(999, checker)).toEqual({ ok: false, error: "notFound" });
    });

    it("asks again after a change, and whoever changed it can't approve it either", async () => {
      await create(campaign("giving-day"));
      const { id } = await only();
      expect(await update(id, campaign("giving-day", { goalCents: 9 }), checker)).toEqual({
        ok: true,
        asked: "new",
      });
      expect(await only()).toMatchObject({ approval: "pending", requestedById: checker });
      // The creator and the last editor are both out.
      expect(await review(id, checker)).toEqual({ ok: false, error: "ownCampaign" });
      expect(await review(id, maker)).toEqual({ ok: false, error: "ownCampaign" });
    });

    it("keeps a reason when turned down, and asks again once changed", async () => {
      await create(campaign("giving-day"));
      const { id } = await only();
      expect(await review(id, checker, false, "Goal looks wrong")).toEqual({ ok: true });
      expect(await only()).toMatchObject({ approval: "rejected", reviewNote: "Goal looks wrong" });

      await update(id, campaign("giving-day", { goalCents: 50_000 }));
      expect(await only()).toMatchObject({
        approval: "pending",
        reviewedById: null,
        reviewNote: null,
      });
      expect(await review(id, checker)).toEqual({ ok: true });
    });

    it("keeps an approved campaign as it is while a change waits, then applies it", async () => {
      const id = await approved();
      const later = new Date(Date.now() + 9 * DAY);
      expect(
        await update(id, campaign("giving-day-2", { goalCents: 5_000, endsAt: later })),
      ).toEqual({
        ok: true,
        asked: "change",
      });
      expect(await only()).toMatchObject({
        approval: "approved",
        slug: "giving-day",
        goalCents: 100_000,
        endsAt: null,
        changeRequestedById: maker,
        proposedChange: { slug: "giving-day-2", goalCents: 5_000, endsAt: later.toISOString() },
      });

      // Whoever asked can't approve it; anyone else with the permission can, even the creator.
      expect(await review(id, maker)).toEqual({ ok: false, error: "ownCampaign" });
      expect(await review(id, checker)).toEqual({ ok: true });
      const after = await only();
      expect(after).toMatchObject({
        slug: "giving-day-2",
        goalCents: 5_000,
        proposedChange: null,
        changeReviewedById: checker,
      });
      expect(after.endsAt?.getTime()).toBe(later.getTime());
      expect(await review(id, checker)).toEqual({ ok: false, error: "notPending" });
    });

    it("lets the campaign's creator approve a change someone else asked for", async () => {
      const id = await approved();
      await update(id, campaign("giving-day", { goalCents: 7 }), checker);
      expect(await review(id, checker)).toEqual({ ok: false, error: "ownCampaign" });
      expect(await review(id, maker)).toEqual({ ok: true });
      expect((await only()).goalCents).toBe(7);
    });

    it("refuses a review of a version the reviewer didn't see", async () => {
      const id = await approved();
      await update(id, campaign("giving-day", { goalCents: 1 }));
      const seen = (await only()).changeRequestedAt;
      await tick();
      await update(id, campaign("giving-day", { goalCents: 2 }));
      expect(await review(id, checker, true, null, seen)).toEqual({
        ok: false,
        error: "reviewOutdated",
      });
      expect((await only()).goalCents).toBe(100_000);
    });

    it("turns a change down with or without a reason, and leaves the campaign alone", async () => {
      const id = await approved();
      await update(id, campaign("giving-day", { goalCents: 1 }));
      expect(await review(id, checker, false, "Too low")).toEqual({ ok: true });
      expect(await only()).toMatchObject({
        goalCents: 100_000,
        proposedChange: null,
        changeReviewNote: "Too low",
      });

      await update(id, campaign("giving-day", { goalCents: 2 }));
      expect((await only()).changeReviewNote).toBeNull();
      await review(id, checker, false);
      expect((await only()).changeReviewNote).toBe("");
    });

    it("withdraws a waiting change when it's saved back to how the campaign is", async () => {
      const id = await approved();
      await update(id, campaign("giving-day", { goalCents: 1 }));
      expect(await update(id, campaign("giving-day"))).toEqual({ ok: true, asked: "none" });
      expect((await only()).proposedChange).toBeNull();
    });

    it("refuses changes that can't be applied", async () => {
      const id = await approved();
      await create(campaign("taken"));
      expect(await update(id, campaign("taken"))).toEqual({ ok: false, error: "slugTaken" });
      await giveTo(id, 100);
      expect(await update(id, campaign("renamed"))).toEqual({ ok: false, error: "hasGifts" });
    });

    it("refuses any other change to an approved campaign at the database", async () => {
      const id = await approved();
      const set = (values: Partial<typeof schema.campaigns.$inferInsert>) =>
        db.update(schema.campaigns).set(values).where(eq(schema.campaigns.id, id));
      await expect(set({ goalCents: 1 })).rejects.toThrow();
      await expect(set({ approval: "pending" })).rejects.toThrow();

      // Even with a waiting change, it has to be applied as asked, by someone else.
      await update(id, campaign("giving-day", { goalCents: 1 }));
      await expect(
        set({ goalCents: 2, changeReviewedById: checker, changeReviewedAt: new Date() }),
      ).rejects.toThrow();
      await expect(
        set({ goalCents: 1, changeReviewedById: maker, changeReviewedAt: new Date() }),
      ).rejects.toThrow();
      await set({ goalCents: 1, changeReviewedById: checker, changeReviewedAt: new Date() });
      expect((await only()).goalCents).toBe(1);
    });

    it("refuses a self-approval at the database too", async () => {
      await create(campaign("giving-day"));
      const { id } = await only();
      await expect(
        db
          .update(schema.campaigns)
          .set({ approval: "approved", reviewedById: maker })
          .where(eq(schema.campaigns.id, id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(schema.campaigns)
          .set({ approval: "approved" })
          .where(eq(schema.campaigns.id, id)),
      ).rejects.toThrow();
    });
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
