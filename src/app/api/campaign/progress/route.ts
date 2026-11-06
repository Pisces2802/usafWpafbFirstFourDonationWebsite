import type { NextRequest } from "next/server";

import { getCampaignProgress } from "@/lib/campaign-progress";
import { campaignSlugSchema } from "@/lib/donation-schema";

export const GET = async (request: NextRequest) => {
  const slug = campaignSlugSchema.safeParse(request.nextUrl.searchParams.get("campaignId"));
  if (!slug.success) return Response.json({ error: "invalid" }, { status: 400 });

  const progress = await getCampaignProgress(slug.data);
  if (!progress) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json(progress, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
};
