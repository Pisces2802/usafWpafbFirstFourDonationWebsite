import type { MetadataRoute } from "next";

import { env } from "@/env";
import { buildSitemap } from "@/lib/seo";
import { getPublishedStorySlugs } from "@/lib/stories/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(env.NEXT_PUBLIC_SITE_URL, await getPublishedStorySlugs());
}
