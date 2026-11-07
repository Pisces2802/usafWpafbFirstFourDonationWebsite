import type { MDXContent } from "mdx/types";

import type { Locale } from "@/i18n/routing";

type LegalBody = () => Promise<{ default: MDXContent }>;

export type LegalDoc = {
  titleKey: "privacy" | "donorPrivacy" | "terms";
  href: "/privacy" | "/donor-privacy" | "/terms";
  body: Record<Locale, LegalBody>;
};

/**
 * Plain-language drafts written from what the site actually does. `isDraft` shows a notice on
 * every legal page until the group has reviewed them, ideally with legal advice.
 */
export const legalConfig = {
  lastUpdated: "2026-11-07",
  isDraft: true,
} as const;

export const legalDocs = {
  privacy: {
    titleKey: "privacy",
    href: "/privacy",
    body: {
      en: () => import("../../content/legal/en/privacy.mdx"),
      es: () => import("../../content/legal/es/privacy.mdx"),
      fr: () => import("../../content/legal/fr/privacy.mdx"),
    },
  },
  donorPrivacy: {
    titleKey: "donorPrivacy",
    href: "/donor-privacy",
    body: {
      en: () => import("../../content/legal/en/donor-privacy.mdx"),
      es: () => import("../../content/legal/es/donor-privacy.mdx"),
      fr: () => import("../../content/legal/fr/donor-privacy.mdx"),
    },
  },
  terms: {
    titleKey: "terms",
    href: "/terms",
    body: {
      en: () => import("../../content/legal/en/terms.mdx"),
      es: () => import("../../content/legal/es/terms.mdx"),
      fr: () => import("../../content/legal/fr/terms.mdx"),
    },
  },
} as const satisfies Record<string, LegalDoc>;
