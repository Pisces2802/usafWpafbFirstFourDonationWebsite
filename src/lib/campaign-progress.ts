import "server-only";

import { and, countDistinct, eq, inArray, sql } from "drizzle-orm";
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
