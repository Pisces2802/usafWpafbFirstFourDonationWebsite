import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { buildSecurityHeaders } from "./src/config/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withMDX = createMDX();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    agentFeedback: true,
    authInterrupts: true,
  },
  cacheComponents: true,
  headers: async () => [
    {
      source: "/:path*",
      headers: buildSecurityHeaders({
        isDev: process.env.NODE_ENV === "development",
        heroVideoBaseUrl: process.env.NEXT_PUBLIC_HERO_VIDEO_BASE_URL,
      }),
    },
  ],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(withMDX(nextConfig));
