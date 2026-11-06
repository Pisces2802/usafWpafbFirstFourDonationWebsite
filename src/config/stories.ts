import type { MDXContent } from "mdx/types";

import type { FundId } from "@/config/donation";
import type { Locale } from "@/i18n/routing";

type StoryBody = () => Promise<{ default: MDXContent }>;

export type Story = {
  slug: string;
  fundId: FundId;
  publishedAt: string;
  /** Written to show the layout; replace with real stories shared with permission before launch. */
  isSample: boolean;
  body: Record<Locale, StoryBody>;
};

/**
 * Story metadata. Titles, names, quotes and summaries live in the messages files under
 * `Stories.items.<slug>`; the story text lives in `content/stories/<locale>/<slug>.mdx`.
 */
export const stories = [
  {
    slug: "kept-on-the-road",
    fundId: "emergency",
    publishedAt: "2026-09-14",
    isSample: true,
    body: {
      en: () => import("../../content/stories/en/kept-on-the-road.mdx"),
      es: () => import("../../content/stories/es/kept-on-the-road.mdx"),
      fr: () => import("../../content/stories/fr/kept-on-the-road.mdx"),
    },
  },
  {
    slug: "holding-the-fort",
    fundId: "families",
    publishedAt: "2026-08-03",
    isSample: true,
    body: {
      en: () => import("../../content/stories/en/holding-the-fort.mdx"),
      es: () => import("../../content/stories/es/holding-the-fort.mdx"),
      fr: () => import("../../content/stories/fr/holding-the-fort.mdx"),
    },
  },
  {
    slug: "second-takeoff",
    fundId: "transition",
    publishedAt: "2026-06-21",
    isSample: true,
    body: {
      en: () => import("../../content/stories/en/second-takeoff.mdx"),
      es: () => import("../../content/stories/es/second-takeoff.mdx"),
      fr: () => import("../../content/stories/fr/second-takeoff.mdx"),
    },
  },
] as const satisfies readonly Story[];

export type StorySlug = (typeof stories)[number]["slug"];

export const featuredStorySlug: StorySlug = "kept-on-the-road";

export const getStory = (slug: string): StoryEntry | null =>
  stories.find((story) => story.slug === slug) ?? null;

export type StoryEntry = (typeof stories)[number];
