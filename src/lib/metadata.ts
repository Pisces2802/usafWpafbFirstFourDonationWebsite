import type { Metadata } from "next";

import { getPathname } from "@/i18n/navigation";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";

type PageMetadataInput = {
  locale: Locale;
  pathname: AppPathname;
  title?: string;
  description?: string;
};

/**
 * Builds per-page metadata with a localised canonical URL and hreflang alternates (incl. x-default).
 * Title and description are only set when given, so pages without them keep the layout's defaults.
 */
export const buildPageMetadata = ({
  locale,
  pathname,
  title,
  description,
}: PageMetadataInput): Metadata => ({
  ...(title && { title }),
  ...(description && { description }),
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
