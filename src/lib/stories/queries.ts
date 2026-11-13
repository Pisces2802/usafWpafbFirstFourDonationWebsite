import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { type FundId, isFundId } from "@/config/donation";
import { getDb } from "@/db";
import { stories } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import type { StoryContent, StoryLocaleContent } from "@/lib/stories/story-schema";

export const STORIES_TAG = "stories";

type PublishedRow = {
  slug: string;
  fundId: FundId;
  isFeatured: boolean;
  isSample: boolean;
  publishedOn: string;
  content: StoryContent;
};

/** A published story in one language, ready for the public pages. */
export type PublicStory = Omit<PublishedRow, "content"> & StoryLocaleContent;

/**
 * Every published story, newest first. Cached, and refreshed as soon as someone saves or deletes
 * a story in the back office. Empty when there's no database or it can't be read.
 */
const listPublished = async (): Promise<PublishedRow[]> => {
  "use cache";
  // Saving a story expires this straight away, so the timer is only a backstop.
  cacheLife({ stale: 300, revalidate: 3600, expire: 86_400 });
  cacheTag(STORIES_TAG);

  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        slug: stories.slug,
        fundId: stories.fundId,
        isFeatured: stories.isFeatured,
        isSample: stories.isSample,
        publishedOn: stories.publishedOn,
        content: stories.content,
      })
      .from(stories)
      .where(eq(stories.status, "published"))
      .orderBy(desc(stories.publishedOn), desc(stories.id));
    return rows.filter((row): row is PublishedRow => isFundId(row.fundId));
  } catch (error) {
    console.error("Reading stories failed", error);
    return [];
  }
};

/** The story in `locale`, or in English when it hasn't been translated. */
const localize =
  (locale: Locale) =>
  ({ content, ...story }: PublishedRow): PublicStory => ({
    ...story,
    ...(content[locale] ?? content.en),
  });

/** Slug and date of every published story, for the sitemap. */
export const getPublishedStorySlugs = async () =>
  (await listPublished()).map(({ slug, publishedOn }) => ({ slug, publishedOn }));

export const getPublishedStories = async (locale: Locale) =>
  (await listPublished()).map(localize(locale));

export const getPublishedStory = async (slug: string, locale: Locale) => {
  const row = (await listPublished()).find((story) => story.slug === slug);
  return row ? localize(locale)(row) : null;
};

/** The story picked for the home page, or the newest one when none is. */
export const getFeaturedStory = async (locale: Locale) => {
  const rows = await listPublished();
  const row = rows.find((story) => story.isFeatured) ?? rows[0];
  return row ? localize(locale)(row) : null;
};
