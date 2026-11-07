import "server-only";

import { and, count, countDistinct, desc, eq, gte, inArray, max, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { campaigns, donations, donors, funds, volunteers } from "@/db/schema";

/** Upper bound on rows sent to a client-side table. Past this, the list needs server paging. */
export const ADMIN_ROW_LIMIT = 5000;

const MONTHLY_ACTIVE_WINDOW_DAYS = 35;

const counted = inArray(donations.status, ["succeeded", "refunded"]);

const netCents = sql<number>`coalesce(sum(${donations.amountCents} - least(${donations.refundedCents}, ${donations.amountCents})), 0)::int`;

export type AdminOverview = {
  netCents: number;
  feesCoveredCents: number;
  refundedCents: number;
  giftCount: number;
  donorCount: number;
  monthlyDonorCount: number;
};

/**
 * Headline numbers for the dashboard, optionally from `since` onwards. Net excludes the card fees
 * donors added and anything refunded. Monthly donors are subscriptions billed in the last 35 days,
 * since cancellations aren't recorded yet.
 */
export const getAdminOverview = async (
  db: Db,
  { since, now = new Date() }: { since?: Date; now?: Date } = {},
): Promise<AdminOverview> => {
  const range = since ? and(counted, gte(donations.createdAt, since)) : counted;
  const monthlyFrom = new Date(now.getTime() - MONTHLY_ACTIVE_WINDOW_DAYS * 86_400_000);

  const [[totals], [monthly]] = await Promise.all([
    db
      .select({
        netCents,
        feesCoveredCents: sql<number>`coalesce(sum(${donations.feeCoveredCents}), 0)::int`,
        refundedCents: sql<number>`coalesce(sum(${donations.refundedCents}), 0)::int`,
        giftCount: count(),
        donorCount: countDistinct(donations.donorId),
      })
      .from(donations)
      .where(range),
    db
      .select({ monthlyDonorCount: countDistinct(donations.stripeSubscriptionId) })
      .from(donations)
      .where(
        and(
          eq(donations.frequency, "monthly"),
          eq(donations.status, "succeeded"),
          gte(donations.createdAt, monthlyFrom),
        ),
      ),
  ]);

  return {
    netCents: totals?.netCents ?? 0,
    feesCoveredCents: totals?.feesCoveredCents ?? 0,
    refundedCents: totals?.refundedCents ?? 0,
    giftCount: totals?.giftCount ?? 0,
    donorCount: totals?.donorCount ?? 0,
    monthlyDonorCount: monthly?.monthlyDonorCount ?? 0,
  };
};

export type AdminDonationRow = Awaited<ReturnType<typeof listDonations>>[number];

/** Most recent gifts first, with the donor, fund and campaign each gift belongs to. */
export const listDonations = (db: Db, { limit = ADMIN_ROW_LIMIT }: { limit?: number } = {}) =>
  db
    .select({
      id: donations.id,
      createdAt: donations.createdAt,
      amountCents: donations.amountCents,
      feeCoveredCents: donations.feeCoveredCents,
      refundedCents: donations.refundedCents,
      frequency: donations.frequency,
      status: donations.status,
      fund: funds.slug,
      campaign: campaigns.slug,
      tributeType: donations.tributeType,
      honoreeName: donations.honoreeName,
      donorId: donors.id,
      donorEmail: donors.email,
      donorFirstName: donors.firstName,
      donorLastName: donors.lastName,
      stripePaymentIntentId: donations.stripePaymentIntentId,
      stripeInvoiceId: donations.stripeInvoiceId,
    })
    .from(donations)
    .innerJoin(donors, eq(donations.donorId, donors.id))
    .innerJoin(funds, eq(donations.fundId, funds.id))
    .leftJoin(campaigns, eq(donations.campaignId, campaigns.id))
    .orderBy(desc(donations.createdAt), desc(donations.id))
    .limit(limit);

export type AdminDonorRow = Awaited<ReturnType<typeof listDonors>>[number];

/** Donors with lifetime net giving, ordered by their most recent gift. */
export const listDonors = (db: Db, { limit = ADMIN_ROW_LIMIT }: { limit?: number } = {}) => {
  const lastGiftAt = max(donations.createdAt);

  return db
    .select({
      id: donors.id,
      email: donors.email,
      firstName: donors.firstName,
      lastName: donors.lastName,
      locale: donors.locale,
      marketingOptIn: donors.marketingOptIn,
      createdAt: donors.createdAt,
      netCents,
      giftCount: count(donations.id),
      lastGiftAt,
      isMonthly: sql<boolean>`coalesce(bool_or(${donations.frequency} = 'monthly'), false)`,
    })
    .from(donors)
    .leftJoin(donations, and(eq(donations.donorId, donors.id), counted))
    .groupBy(donors.id)
    .orderBy(sql`${lastGiftAt} desc nulls last`, desc(donors.id))
    .limit(limit);
};

export type AdminVolunteerRow = Awaited<ReturnType<typeof listVolunteers>>[number];

/** Volunteer sign-ups, newest first. */
export const listVolunteers = (db: Db, { limit = ADMIN_ROW_LIMIT }: { limit?: number } = {}) =>
  db.select().from(volunteers).orderBy(desc(volunteers.createdAt)).limit(limit);
