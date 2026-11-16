import "server-only";

import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import { FUND_IDS, type FundId } from "@/config/donation";
import type { Db } from "@/db";
import { adminUsers, type CampaignChange, campaigns, donations, funds } from "@/db/schema";
import { isUniqueViolation } from "@/lib/admin/team-queries";
import type { CatalogError, CatalogResult } from "@/lib/admin/catalog-schema";
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

const requester = alias(adminUsers, "requester");
const reviewer = alias(adminUsers, "reviewer");
const changeRequester = alias(adminUsers, "change_requester");
const changeReviewer = alias(adminUsers, "change_reviewer");

/** Every campaign with what it has raised and where it is in approval, newest first. */
export const listCampaigns = (db: Db) =>
  db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      goalCents: campaigns.goalCents,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
      status: campaignStatus,
      approval: campaigns.approval,
      createdById: campaigns.createdById,
      requestedById: campaigns.requestedById,
      requestedByName: requester.name,
      requestedAt: campaigns.requestedAt,
      reviewedByName: reviewer.name,
      reviewNote: campaigns.reviewNote,
      proposedChange: campaigns.proposedChange,
      changeRequestedById: campaigns.changeRequestedById,
      changeRequestedByName: changeRequester.name,
      changeRequestedAt: campaigns.changeRequestedAt,
      changeReviewedByName: changeReviewer.name,
      changeReviewNote: campaigns.changeReviewNote,
      ...totals,
    })
    .from(campaigns)
    .leftJoin(donations, and(eq(donations.campaignId, campaigns.id), counted))
    .leftJoin(requester, eq(requester.id, campaigns.requestedById))
    .leftJoin(reviewer, eq(reviewer.id, campaigns.reviewedById))
    .leftJoin(changeRequester, eq(changeRequester.id, campaigns.changeRequestedById))
    .leftJoin(changeReviewer, eq(changeReviewer.id, campaigns.changeReviewedById))
    .groupBy(campaigns.id, requester.id, reviewer.id, changeRequester.id, changeReviewer.id)
    .orderBy(desc(campaigns.id));

export type AdminCampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

export type CampaignRecord = {
  slug: string;
  goalCents: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** A waiting change as the live fields it would set. */
export const changeToRecord = (change: CampaignChange): CampaignRecord => ({
  slug: change.slug,
  goalCents: change.goalCents,
  startsAt: change.startsAt ? new Date(change.startsAt) : null,
  endsAt: change.endsAt ? new Date(change.endsAt) : null,
});

const sameInstant = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Whether two versions of a campaign have the same link, goal and dates. */
export const sameCampaign = (a: CampaignRecord, b: CampaignRecord) =>
  a.slug === b.slug &&
  a.goalCents === b.goalCents &&
  sameInstant(a.startsAt, b.startsAt) &&
  sameInstant(a.endsAt, b.endsAt);

export const findCampaign = async (db: Db, id: number) => {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return campaign;
};

/** Adds a campaign waiting for someone other than `createdById` to approve it. */
export const createCampaign = async (
  db: Db,
  values: CampaignRecord,
  createdById: number,
): Promise<CatalogResult> => {
  try {
    await db.insert(campaigns).values({
      ...values,
      approval: "pending",
      createdById,
      requestedById: createdById,
      requestedAt: new Date(),
    });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
};

/** What saving a campaign did: changed it straight away, or asked for its change to be approved. */
export type CampaignSave =
  { ok: true; asked: "new" | "change" | "none" } | { ok: false; error: CatalogError };

/**
 * Saves a campaign's link, goal and dates. The link (slug) can only change before any gift has
 * come in, since gifts are tagged by it and links already shared would stop counting.
 *
 * Nothing changes on its own once a campaign is approved: the change waits in `proposedChange`
 * for someone other than `editorId` to approve it, and the campaign stays as it is on the site.
 * Saving it unchanged withdraws a waiting change. A campaign that isn't approved yet (or was
 * turned down) changes in place and asks again, with `editorId` as the one asking.
 */
export const updateCampaign = async (
  db: Db,
  id: number,
  values: CampaignRecord,
  editorId: number,
): Promise<CampaignSave> => {
  const current = await findCampaign(db, id);
  if (!current) return { ok: false, error: "notFound" };
  if (values.slug !== current.slug && (await hasGifts(db, id))) {
    return { ok: false, error: "hasGifts" };
  }

  if (current.approval === "approved") {
    if (sameCampaign(values, current)) {
      if (current.proposedChange) {
        await db.update(campaigns).set({ proposedChange: null }).where(eq(campaigns.id, id));
      }
      return { ok: true, asked: "none" };
    }
    if (values.slug !== current.slug && (await slugInUse(db, values.slug, id))) {
      return { ok: false, error: "slugTaken" };
    }
    await db
      .update(campaigns)
      .set({
        proposedChange: {
          slug: values.slug,
          goalCents: values.goalCents,
          startsAt: values.startsAt?.toISOString() ?? null,
          endsAt: values.endsAt?.toISOString() ?? null,
        },
        changeRequestedById: editorId,
        changeRequestedAt: new Date(),
        changeReviewedById: null,
        changeReviewedAt: null,
        changeReviewNote: null,
      })
      .where(eq(campaigns.id, id));
    return { ok: true, asked: "change" };
  }

  try {
    await db
      .update(campaigns)
      .set({
        ...values,
        approval: "pending",
        requestedById: editorId,
        requestedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      })
      .where(eq(campaigns.id, id));
    return { ok: true, asked: "new" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
};

const slugInUse = async (db: Db, slug: string, exceptId: number) => {
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.slug, slug), ne(campaigns.id, exceptId)))
    .limit(1);
  return row !== undefined;
};

const hasGifts = async (db: Db, campaignId: number) => {
  const [row] = await db
    .select({ id: donations.id })
    .from(donations)
    .where(eq(donations.campaignId, campaignId))
    .limit(1);
  return row !== undefined;
};

type Review = {
  reviewerId: number;
  approve: boolean;
  note: string | null;
  /**
   * When the version the reviewer looked at was asked for. If someone has changed it since, the
   * review is refused, so nobody approves something they haven't seen.
   */
  seenAt: Date | null;
};

const askedAt = (column: AnyPgColumn, seenAt: Date | null) =>
  seenAt ? eq(column, seenAt) : isNull(column);

const notBy = (column: AnyPgColumn, reviewerId: number) =>
  or(isNull(column), ne(column, reviewerId));

/** What a review did, for the audit log. */
export type CampaignReview =
  | { ok: true; kind: "new" }
  | { ok: true; kind: "change"; before: CampaignRecord; after: CampaignRecord }
  | { ok: false; error: CatalogError };

/**
 * Approves or turns down what's waiting on a campaign: the campaign itself if it's new, or a
 * change to an approved one. Refused for whoever asked (and, for a new campaign, whoever created
 * it), in the same statement that saves it, so nothing slips through between a check and the
 * write. An approved change is applied exactly as it was asked for.
 */
export const reviewCampaign = async (
  db: Db,
  id: number,
  { reviewerId, approve, note, seenAt }: Review,
): Promise<CampaignReview> => {
  const current = await findCampaign(db, id);
  if (!current) return { ok: false, error: "notFound" };

  if (current.approval === "pending") {
    const [reviewed] = await db
      .update(campaigns)
      .set({
        approval: approve ? "approved" : "rejected",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: approve ? null : note,
      })
      .where(
        and(
          eq(campaigns.id, id),
          eq(campaigns.approval, "pending"),
          notBy(campaigns.createdById, reviewerId),
          notBy(campaigns.requestedById, reviewerId),
          askedAt(campaigns.requestedAt, seenAt),
        ),
      )
      .returning({ id: campaigns.id });
    if (reviewed) return { ok: true, kind: "new" };
    return refusal(db, id, reviewerId);
  }

  const change = current.proposedChange;
  if (current.approval !== "approved" || !change) return { ok: false, error: "notPending" };
  const after = changeToRecord(change);
  if (approve && after.slug !== current.slug && (await hasGifts(db, id))) {
    return { ok: false, error: "hasGifts" };
  }

  const waiting = and(
    eq(campaigns.id, id),
    sql`${campaigns.proposedChange} is not null`,
    ne(campaigns.changeRequestedById, reviewerId),
    askedAt(campaigns.changeRequestedAt, seenAt),
  );
  const decided = { changeReviewedById: reviewerId, changeReviewedAt: new Date() };
  try {
    const [reviewed] = await db
      .update(campaigns)
      .set(
        approve
          ? {
              // Straight from the stored change, so what's applied is exactly what was asked.
              slug: sql`${campaigns.proposedChange}->>'slug'`,
              goalCents: sql`(${campaigns.proposedChange}->>'goalCents')::integer`,
              startsAt: sql`(${campaigns.proposedChange}->>'startsAt')::timestamptz`,
              endsAt: sql`(${campaigns.proposedChange}->>'endsAt')::timestamptz`,
              proposedChange: null,
              changeReviewNote: null,
              ...decided,
            }
          : // An empty note still marks the change as turned down, so whoever asked sees it.
            { proposedChange: null, changeReviewNote: note ?? "", ...decided },
      )
      .where(waiting)
      .returning({ id: campaigns.id });
    if (reviewed) {
      const before = {
        slug: current.slug,
        goalCents: current.goalCents,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
      };
      return { ok: true, kind: "change", before, after };
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
  return refusal(db, id, reviewerId);
};

/** Why a review didn't save: it's theirs, it's been decided, or it changed since they looked. */
const refusal = async (db: Db, id: number, reviewerId: number): Promise<CampaignReview> => {
  const now = await findCampaign(db, id);
  if (!now) return { ok: false, error: "notFound" };
  if (now.approval === "pending") {
    return now.createdById === reviewerId || now.requestedById === reviewerId
      ? { ok: false, error: "ownCampaign" }
      : { ok: false, error: "reviewOutdated" };
  }
  if (now.approval === "approved" && now.proposedChange) {
    return now.changeRequestedById === reviewerId
      ? { ok: false, error: "ownCampaign" }
      : { ok: false, error: "reviewOutdated" };
  }
  return { ok: false, error: "notPending" };
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
