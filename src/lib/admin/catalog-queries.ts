import "server-only";

import { and, count, countDistinct, desc, eq, inArray, max, sql } from "drizzle-orm";

import { FUND_IDS, type FundId } from "@/config/donation";
import type { Db } from "@/db";
import { campaigns, donations, funds } from "@/db/schema";
import { isUniqueViolation } from "@/lib/admin/team-queries";
import type { CatalogResult } from "@/lib/admin/catalog-schema";
import { resolveActiveFunds } from "@/lib/fund-settings";

const counted = inArray(donations.status, ["succeeded", "refunded"]);

const netCents = sql<number>`coalesce(sum(${donations.amountCents} - least(${donations.refundedCents}, ${donations.amountCents})), 0)::int`;

const totals = {
  raisedCents: netCents,
  giftCount: count(donations.id),
  donorCount: countDistinct(donations.donorId),
  lastGiftAt: max(donations.createdAt),
};

export type CampaignStatus = "upcoming" | "live" | "ended";

/** Whether a campaign has started or finished, by the database clock. */
const campaignStatus = sql<CampaignStatus>`case when ${campaigns.startsAt} > now() then 'upcoming' when ${campaigns.endsAt} < now() then 'ended' else 'live' end`;

/** Every campaign with what it has raised, newest first. */
export const listCampaigns = (db: Db) =>
  db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      goalCents: campaigns.goalCents,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
      status: campaignStatus,
      ...totals,
    })
    .from(campaigns)
    .leftJoin(donations, and(eq(donations.campaignId, campaigns.id), counted))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.id));

export type AdminCampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

type CampaignRecord = {
  slug: string;
  goalCents: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

export const findCampaign = async (db: Db, id: number) => {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return campaign;
};

export const createCampaign = async (db: Db, values: CampaignRecord): Promise<CatalogResult> => {
  try {
    await db.insert(campaigns).values(values);
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
};

/**
 * Saves a campaign's goal and dates. The link (slug) can only change before any gift has come in,
 * since gifts are tagged by it and links already shared would stop counting.
 */
export const updateCampaign = async (
  db: Db,
  id: number,
  values: CampaignRecord,
): Promise<CatalogResult> => {
  const current = await findCampaign(db, id);
  if (!current) return { ok: false, error: "notFound" };
  if (values.slug !== current.slug && (await hasGifts(db, id))) {
    return { ok: false, error: "hasGifts" };
  }
  try {
    await db.update(campaigns).set(values).where(eq(campaigns.id, id));
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
};

const hasGifts = async (db: Db, campaignId: number) => {
  const [row] = await db
    .select({ id: donations.id })
    .from(donations)
    .where(eq(donations.campaignId, campaignId))
    .limit(1);
  return row !== undefined;
};

/** Deletes a campaign that no gift points at. Ones with gifts stay, so the record stays whole. */
export const deleteCampaign = async (db: Db, id: number): Promise<CatalogResult> => {
  if (await hasGifts(db, id)) return { ok: false, error: "hasGifts" };
  const deleted = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
  return deleted.length ? { ok: true } : { ok: false, error: "notFound" };
};

export type AdminFundRow = {
  id: FundId;
  isActive: boolean;
  raisedCents: number;
  giftCount: number;
  donorCount: number;
  lastGiftAt: Date | null;
};

/** Every fund in code, in the saved order, with whether it's on and what it has raised. */
export const listFunds = async (db: Db): Promise<AdminFundRow[]> => {
  const [rows, raised] = await Promise.all([
    db
      .select({ slug: funds.slug, isActive: funds.isActive, sortOrder: funds.sortOrder })
      .from(funds),
    db
      .select({ slug: funds.slug, ...totals })
      .from(donations)
      .innerJoin(funds, eq(donations.fundId, funds.id))
      .where(counted)
      .groupBy(funds.slug),
  ]);
  const saved = new Map(rows.map((row) => [row.slug, row.isActive]));
  // Resolving with every fund switched on gives the full saved order, not just the active ones.
  const order = resolveActiveFunds(rows.map((row) => ({ ...row, isActive: true })));
  const bySlug = new Map(raised.map((row) => [row.slug, row]));

  return order.map((id) => ({
    id,
    isActive: saved.get(id) ?? true,
    raisedCents: bySlug.get(id)?.raisedCents ?? 0,
    giftCount: bySlug.get(id)?.giftCount ?? 0,
    donorCount: bySlug.get(id)?.donorCount ?? 0,
    lastGiftAt: bySlug.get(id)?.lastGiftAt ?? null,
  }));
};

/** Saves each fund's position, creating rows for funds that haven't had a gift yet. */
export const saveFundOrder = (db: Db, order: readonly FundId[]) =>
  db.transaction(async (tx) => {
    for (const [sortOrder, slug] of order.entries()) {
      await tx
        .insert(funds)
        .values({ slug, sortOrder })
        .onConflictDoUpdate({ target: funds.slug, set: { sortOrder } });
    }
  });

/** Turns a fund on or off for donors. At least one fund has to stay on. */
export const setFundActive = async (
  db: Db,
  id: FundId,
  isActive: boolean,
): Promise<CatalogResult> => {
  if (!isActive) {
    const current = await listFunds(db);
    const othersOn = current.some((fund) => fund.id !== id && fund.isActive);
    if (!othersOn) return { ok: false, error: "lastFund" };
  }
  const sortOrder = FUND_IDS.indexOf(id);
  await db
    .insert(funds)
    .values({ slug: id, isActive, sortOrder })
    .onConflictDoUpdate({ target: funds.slug, set: { isActive } });
  return { ok: true };
};
