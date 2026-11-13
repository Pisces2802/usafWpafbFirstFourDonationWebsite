import type { MetadataRoute } from "next";

import { env } from "@/env";

/** The back office and API stay out of search; admin pages are also marked noindex. */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
