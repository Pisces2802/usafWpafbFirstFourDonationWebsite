import type { Metadata } from "next";

import { getPathname } from "@/i18n/navigation";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";

type PageMetadataInput = {
  locale: Locale;
  pathname: AppPathname;
  title?: string;
  description?: string;
};

/** Builds per-page metadata with a localised canonical URL and hreflang alternates (incl. x-default). */
export const buildPageMetadata = ({
  locale,
  pathname,
  title,
  description,
}: PageMetadataInput): Metadata => ({
  title,
  description,
  alternates: {
    canonical: getPathname({ href: pathname, locale }),
    languages: {
      ...Object.fromEntries(
        routing.locales.map((l) => [l, getPathname({ href: pathname, locale: l })]),
      ),
      "x-default": getPathname({ href: pathname, locale: routing.defaultLocale }),
    },
  },
});
