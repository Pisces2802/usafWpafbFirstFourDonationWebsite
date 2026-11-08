import "server-only";

import { and, count, countDistinct, desc, eq, gte, inArray, lt, max, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { campaigns, contactMessages, donations, donors, funds, volunteers } from "@/db/schema";

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

export type AdminMessageRow = Awaited<ReturnType<typeof listContactMessages>>[number];

/** Contact form messages, newest first. */
export const listContactMessages = (db: Db, { limit = ADMIN_ROW_LIMIT }: { limit?: number } = {}) =>
  db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(limit);

export type TrendRange = "daily" | "weekly" | "monthly";

/** Each trend range: the Postgres bucket it groups by, how many buckets, and how to step back one. */
const TREND_RANGES = {
  daily: { unit: "day", buckets: 30 },
  weekly: { unit: "week", buckets: 12 },
  monthly: { unit: "month", buckets: 12 },
} as const satisfies Record<TrendRange, { unit: string; buckets: number }>;

export type TrendPoint = { bucket: string; netCents: number };

export type PeriodTotals = { netCents: number; giftCount: number; donorCount: number };

export type AdminDashboardInsights = {
  /** The last 30 days and the 30 before them, for the change shown on each headline number. */
  current: PeriodTotals;
  previous: PeriodTotals;
  trends: Record<TrendRange, TrendPoint[]>;
  byFund: { fund: string; netCents: number }[];
  campaigns: { slug: string; goalCents: number; raisedCents: number }[];
};

const PERIOD_DAYS = 30;
const DAY_MS = 86_400_000;

const toBucketKey = (date: Date) => date.toISOString().slice(0, 10);

/** Bucket start dates (UTC, oldest first) matching Postgres `date_trunc` for the range. */
export const trendBuckets = (range: TrendRange, now: Date): Date[] => {
  const { unit, buckets } = TREND_RANGES[range];
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return Array.from({ length: buckets }, (_, index) => {
    const back = buckets - 1 - index;
    if (unit === "day") return new Date(today.getTime() - back * DAY_MS);
    if (unit === "week") {
      const monday = today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS;
      return new Date(monday - back * 7 * DAY_MS);
    }
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
  });
};

const periodTotals = async (db: Db, from: Date, to: Date): Promise<PeriodTotals> => {
  const [row] = await db
    .select({ netCents, giftCount: count(), donorCount: countDistinct(donations.donorId) })
    .from(donations)
    .where(and(counted, gte(donations.createdAt, from), lt(donations.createdAt, to)));
  return {
    netCents: row?.netCents ?? 0,
    giftCount: row?.giftCount ?? 0,
    donorCount: row?.donorCount ?? 0,
  };
};

const trendSeries = async (db: Db, range: TrendRange, now: Date): Promise<TrendPoint[]> => {
  const starts = trendBuckets(range, now);
  // `unit` comes from the fixed TREND_RANGES table, never from input, so inlining it is safe.
  const bucket = sql<string>`to_char(date_trunc('${sql.raw(TREND_RANGES[range].unit)}', ${donations.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const rows = await db
    .select({ bucket, netCents })
    .from(donations)
    .where(and(counted, gte(donations.createdAt, starts[0])))
    .groupBy(bucket);
  const byBucket = new Map(rows.map((row) => [row.bucket, row.netCents]));

  return starts.map((start) => {
    const key = toBucketKey(start);
    return { bucket: key, netCents: byBucket.get(key) ?? 0 };
  });
};

/**
 * Everything the dashboard charts need: 30-day totals against the 30 days before, net giving
 * over time at three granularities, all-time net per fund, and the three campaigns that have
 * raised the most against their goals.
 */
export const getDashboardInsights = async (
  db: Db,
  { now = new Date() }: { now?: Date } = {},
): Promise<AdminDashboardInsights> => {
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
  const previousStart = new Date(periodStart.getTime() - PERIOD_DAYS * DAY_MS);

  const [current, previous, daily, weekly, monthly, byFund, topCampaigns] = await Promise.all([
    periodTotals(db, periodStart, now),
    periodTotals(db, previousStart, periodStart),
    trendSeries(db, "daily", now),
    trendSeries(db, "weekly", now),
    trendSeries(db, "monthly", now),
    db
      .select({ fund: funds.slug, netCents })
      .from(donations)
      .innerJoin(funds, eq(donations.fundId, funds.id))
      .where(counted)
      .groupBy(funds.slug)
      .orderBy(desc(netCents)),
    db
      .select({ slug: campaigns.slug, goalCents: campaigns.goalCents, raisedCents: netCents })
      .from(campaigns)
      .leftJoin(donations, and(eq(donations.campaignId, campaigns.id), counted))
      .groupBy(campaigns.id)
      .orderBy(desc(netCents), desc(campaigns.id))
      .limit(3),
  ]);

  return {
    current,
    previous,
    trends: { daily, weekly, monthly },
    byFund: byFund.filter((row) => row.netCents > 0),
    campaigns: topCampaigns,
  };
};
