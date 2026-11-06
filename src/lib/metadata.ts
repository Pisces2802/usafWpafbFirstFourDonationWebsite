import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Href = Parameters<typeof getPathname>[0]["href"];

type PageMetadataInput = {
  locale: Locale;
  href: Href;
  title?: string;
  description?: string;
};

/**
 * Builds per-page metadata with a localised canonical URL and hreflang alternates (incl. x-default).
 * Title and description are only set when given, so pages without them keep the layout's defaults.
 */
export const buildPageMetadata = ({
  locale,
  href,
  title,
  description,
}: PageMetadataInput): Metadata => ({
  ...(title && { title }),
  ...(description && { description }),
  alternates: {
    canonical: getPathname({ href, locale }),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, getPathname({ href, locale: l })])),
      "x-default": getPathname({ href, locale: routing.defaultLocale }),
    },
  },
});

type PageTitleKey = keyof (typeof import("../../messages/en.json"))["Pages"];

/** Metadata for a page whose title is a `Pages` message, optionally with a description message. */
export const getPageMetadata = async (
  params: Promise<{ locale: string }>,
  {
    titleKey,
    href,
    description,
  }: {
    titleKey: Exclude<PageTitleKey, "_reviewed">;
    href: Href;
    description?: (locale: Locale) => Promise<string>;
  },
): Promise<Metadata> => {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Pages" });

  return buildPageMetadata({
    locale,
    href,
    title: t(titleKey),
    description: description ? await description(locale) : undefined,
  });
};
