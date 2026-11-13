import type { MetadataRoute } from "next";

import { type AppPathname, routing, type Locale, type StaticPathname } from "@/i18n/routing";

type Href = StaticPathname | { pathname: AppPathname; params: Record<string, string> };

/**
 * The localised path for `href`, matching next-intl's `getPathname` with `localePrefix: "always"`.
 * Kept free of next-intl's navigation module so it runs outside Next (tests, scripts).
 */
export const localizedPath = (href: Href, locale: Locale) => {
  const { pathname, params = {} } = typeof href === "string" ? { pathname: href } : href;
  const entry = routing.pathnames[pathname];
  const template = typeof entry === "string" ? entry : entry[locale];
  const path = template.replace(/\[(\w+)\]/g, (_, key: string) =>
    encodeURIComponent(params[key] ?? ""),
  );
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
};

/**
 * Public pages listed in the sitemap. Left out on purpose: the thank-you page (noindex, needs a
 * checkout session) and manage-giving (a utility page with nothing to find in search).
 */
export const SITEMAP_PATHS = [
  "/",
  "/donate",
  "/about",
  "/programs",
  "/stories",
  "/get-involved",
  "/contact",
  "/transparency",
  "/privacy",
  "/donor-privacy",
  "/terms",
] as const satisfies readonly StaticPathname[];

type SitemapStory = { slug: string; publishedOn: string };

const absolute = (siteUrl: string, href: Href, locale: Locale) =>
  `${siteUrl.replace(/\/$/, "")}${localizedPath(href, locale)}`;

/** One entry per page per locale, each listing every language version (plus `x-default`). */
const entriesFor = (
  siteUrl: string,
  href: Href,
  extra: Omit<MetadataRoute.Sitemap[number], "url" | "alternates"> = {},
): MetadataRoute.Sitemap => {
  const languages = {
    ...Object.fromEntries(routing.locales.map((l) => [l, absolute(siteUrl, href, l)])),
    "x-default": absolute(siteUrl, href, routing.defaultLocale),
  };
  return routing.locales.map((locale) => ({
    url: absolute(siteUrl, href, locale),
    alternates: { languages },
    ...extra,
  }));
};

/**
 * Builds the sitemap. Every story is listed in every locale, because untranslated stories fall
 * back to English on the localised URL.
 */
export const buildSitemap = (siteUrl: string, stories: SitemapStory[]): MetadataRoute.Sitemap => [
  ...SITEMAP_PATHS.flatMap((path) => entriesFor(siteUrl, path)),
  ...stories.flatMap(({ slug, publishedOn }) =>
    entriesFor(
      siteUrl,
      { pathname: "/stories/[slug]", params: { slug } },
      { lastModified: publishedOn },
    ),
  ),
];

type OrganizationInput = {
  siteUrl: string;
  locale: Locale;
  name: string;
  description: string;
  /** Only set once the group has 501(c)(3) status. */
  ein?: string;
};

/** schema.org `NGO` for the home page. Claims 501(c)(3) status only when an EIN is configured. */
export const buildOrganizationJsonLd = ({
  siteUrl,
  locale,
  name,
  description,
  ein,
}: OrganizationInput) => ({
  "@context": "https://schema.org",
  "@type": "NGO",
  name,
  description,
  url: absolute(siteUrl, "/", locale),
  inLanguage: locale,
  potentialAction: {
    "@type": "DonateAction",
    target: absolute(siteUrl, "/donate", locale),
  },
  ...(ein && { taxID: ein, nonprofitStatus: "Nonprofit501c3" }),
});

/**
 * Serialises JSON-LD for a `<script>` tag. Escapes `<` so text from config or messages can't close
 * the tag early.
 */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
