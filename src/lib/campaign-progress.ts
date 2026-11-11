import "server-only";

import { and, countDistinct, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { campaigns, donations } from "@/db/schema";

export const CAMPAIGN_PROGRESS_TAG = "campaign-progress";

export type CampaignProgress = { raisedCents: number; goalCents: number; donorCount: number };

/**
 * Totals for a campaign, net of refunds and excluding the card fees donors added. Cached for a
 * minute and refreshed early whenever the Stripe webhook records a change.
 */
export const getCampaignProgress = async (slug: string): Promise<CampaignProgress | null> => {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  cacheTag(CAMPAIGN_PROGRESS_TAG);

  const db = getDb();
  if (!db) return null;

  const [campaign] = await db
    .select({ id: campaigns.id, goalCents: campaigns.goalCents })
    .from(campaigns)
    .where(eq(campaigns.slug, slug));
  if (!campaign) return null;

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

/**
 * Progress for whichever campaign is currently active (startsAt <= now AND endsAt >= now, or
 * open-ended). Returns the most recently started campaign if multiple overlap. Returns null when
 * there is no active campaign or no database connection.
 *
 * `now` is passed in so this cached function receives a stable, serialisable value rather than
 * computing `new Date()` inside the cache boundary (which triggers a prerender warning).
 */
export const getActiveCampaignProgress = async (
  now: Date,
): Promise<(CampaignProgress & { slug: string }) | null> => {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  cacheTag(CAMPAIGN_PROGRESS_TAG);

  const db = getDb();
  if (!db) return null;

  const [campaign] = await db
    .select({ id: campaigns.id, slug: campaigns.slug, goalCents: campaigns.goalCents })
    .from(campaigns)
    .where(
      and(
        or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
        or(isNull(campaigns.endsAt), gte(campaigns.endsAt, now)),
      ),
    )
    .orderBy(sql`${campaigns.startsAt} desc nulls last`)
    .limit(1);

  if (!campaign) return null;

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
    slug: campaign.slug,
    raisedCents: totals?.raisedCents ?? 0,
    goalCents: campaign.goalCents,
    donorCount: totals?.donorCount ?? 0,
  };
};
