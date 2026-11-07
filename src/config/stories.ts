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
    slug: "dorm-cookout",
    fundId: "morale",
    publishedAt: "2026-09-14",
    isSample: true,
    body: {
      en: () => import("../../content/stories/en/dorm-cookout.mdx"),
      es: () => import("../../content/stories/es/dorm-cookout.mdx"),
      fr: () => import("../../content/stories/fr/dorm-cookout.mdx"),
    },
  },
  {
    slug: "study-hall",
    fundId: "development",
    publishedAt: "2026-08-03",
    isSample: true,
    body: {
      en: () => import("../../content/stories/en/study-hall.mdx"),
      es: () => import("../../content/stories/es/study-hall.mdx"),
      fr: () => import("../../content/stories/fr/study-hall.mdx"),
    },
  },
  {
    slug: "day-room-rebuild",
    fundId: "community",
    publishedAt: "2026-06-21",
    isSample: true,
    body: {
      en: () => import("../../content/stories/en/day-room-rebuild.mdx"),
      es: () => import("../../content/stories/es/day-room-rebuild.mdx"),
      fr: () => import("../../content/stories/fr/day-room-rebuild.mdx"),
    },
  },
] as const satisfies readonly Story[];

export type StorySlug = (typeof stories)[number]["slug"];

export const featuredStorySlug: StorySlug = "dorm-cookout";

export const getStory = (slug: string): StoryEntry | null =>
  stories.find((story) => story.slug === slug) ?? null;

export type StoryEntry = (typeof stories)[number];
