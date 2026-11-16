import "server-only";

import { and, countDistinct, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { type Db, getDb } from "@/db";
import { campaigns, donations } from "@/db/schema";

export const CAMPAIGN_PROGRESS_TAG = "campaign-progress";

export type CampaignProgress = { raisedCents: number; goalCents: number; donorCount: number };

type CampaignRow = { id: number; slug: string; goalCents: number };

const campaignColumns = { id: campaigns.id, slug: campaigns.slug, goalCents: campaigns.goalCents };

/** Raised (net of refunds, excluding the card fees donors added) and distinct donors. */
const loadProgress = async (db: Db, campaign: CampaignRow): Promise<CampaignProgress> => {
  const [totals] = await db
    .select({
      raisedCents: sql<number>`coalesce(sum(${donations.amountCents} - least(${donations.refundedCents}, ${donations.amountCents})), 0)::int`,
      donorCount: countDistinct(donations.donorId),
    })
    .from(donations)
    .where(
      and(
        eq(donations.campaignId, campaign.id),
        inArray(donations.status, ["succeeded", "refunded"]),
      ),
    );

  return {
    raisedCents: totals?.raisedCents ?? 0,
    goalCents: campaign.goalCents,
    donorCount: totals?.donorCount ?? 0,
  };
};

/** Progress for the approved campaign with this slug, whether or not it's running. */
export const loadCampaignProgress = async (
  db: Db,
  slug: string,
): Promise<CampaignProgress | null> => {
  const [campaign] = await db
    .select(campaignColumns)
    .from(campaigns)
    .where(and(eq(campaigns.slug, slug), eq(campaigns.approval, "approved")));
  return campaign ? loadProgress(db, campaign) : null;
};

/**
 * Progress for the campaign running at `now` (started, or no start date, and not yet ended, or no
 * end date). When several overlap, the one that started most recently wins.
 */
export const loadActiveCampaignProgress = async (
  db: Db,
  now: Date,
): Promise<(CampaignProgress & { slug: string }) | null> => {
  const [campaign] = await db
    .select(campaignColumns)
    .from(campaigns)
    .where(
      and(
        eq(campaigns.approval, "approved"),
        or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
        or(isNull(campaigns.endsAt), gte(campaigns.endsAt, now)),
      ),
    )
    .orderBy(sql`${campaigns.startsAt} desc nulls last`, sql`${campaigns.id} desc`)
    .limit(1);

  return campaign ? { slug: campaign.slug, ...(await loadProgress(db, campaign)) } : null;
};

/**
 * Totals for a campaign. Cached for a minute and refreshed early whenever the Stripe webhook
 * records a change. Null when there's no such campaign or no database.
 */
export const getCampaignProgress = async (slug: string): Promise<CampaignProgress | null> => {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  cacheTag(CAMPAIGN_PROGRESS_TAG);

  const db = getDb();
  return db ? loadCampaignProgress(db, slug) : null;
};

/** The arguments are the cache key, so this takes the minute as a string, not a precise Date. */
const getActiveCampaignProgressAt = async (minute: string) => {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  cacheTag(CAMPAIGN_PROGRESS_TAG);

  const db = getDb();
  return db ? loadActiveCampaignProgress(db, new Date(minute)) : null;
};

/** Rounds down to the minute, so every request in the same minute shares one cache entry. */
export const toCacheMinute = (now: Date) =>
  new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();

/**
 * Progress for whichever campaign is running now, or null. Call it after `connection()` so "now"
 * is request time, not build time.
 */
export const getActiveCampaignProgress = (now: Date = new Date()) =>
  getActiveCampaignProgressAt(toCacheMinute(now));
