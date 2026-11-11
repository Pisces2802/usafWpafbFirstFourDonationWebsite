import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import type { Db, Tx } from "@/db";
import { stories } from "@/db/schema";
import { isUniqueViolation } from "@/lib/admin/team-queries";
import {
  STORY_LOCALES,
  type StoryContent,
  type StoryResult,
  type StoryStatus,
} from "@/lib/stories/story-schema";

/** Every story for the back office, newest first, with its English title and languages. */
export const listStories = async (db: Db) => {
  const rows = await db
    .select({
      id: stories.id,
      slug: stories.slug,
      fundId: stories.fundId,
      status: stories.status,
      isFeatured: stories.isFeatured,
      isSample: stories.isSample,
      publishedOn: stories.publishedOn,
      content: stories.content,
      updatedAt: stories.updatedAt,
    })
    .from(stories)
    .orderBy(desc(stories.publishedOn), desc(stories.id));

  return rows.map(({ content, ...row }) => ({
    ...row,
    title: content.en.title,
    name: content.en.name,
    locales: STORY_LOCALES.filter((locale) => content[locale] !== undefined),
  }));
};

export type AdminStoryRow = Awaited<ReturnType<typeof listStories>>[number];

export const findStory = async (db: Db, id: number) => {
  const [story] = await db.select().from(stories).where(eq(stories.id, id));
  return story;
};

export type AdminStory = NonNullable<Awaited<ReturnType<typeof findStory>>>;

export type StoryRecord = {
  slug: string;
  fundId: string;
  status: StoryStatus;
  isFeatured: boolean;
  isSample: boolean;
  publishedOn: string;
  content: StoryContent;
};

/** Only one story is featured; featuring this one un-features the rest. */
const unfeatureOthers = (tx: Tx, id?: number) =>
  tx
    .update(stories)
    .set({ isFeatured: false })
    .where(and(eq(stories.isFeatured, true), id === undefined ? undefined : ne(stories.id, id)));

export const createStory = async (
  db: Db,
  values: StoryRecord,
  actorId: number,
): Promise<StoryResult> => {
  try {
    const id = await db.transaction(async (tx) => {
      if (values.isFeatured) await unfeatureOthers(tx);
      const [row] = await tx
        .insert(stories)
        .values({ ...values, createdById: actorId, updatedById: actorId })
        .returning({ id: stories.id });
      return row!.id;
    });
    return { ok: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
};

export const updateStory = async (
  db: Db,
  id: number,
  values: StoryRecord,
  actorId: number,
): Promise<StoryResult> => {
  try {
    const updated = await db.transaction(async (tx) => {
      if (values.isFeatured) await unfeatureOthers(tx, id);
      return tx
        .update(stories)
        .set({ ...values, updatedById: actorId })
        .where(eq(stories.id, id))
        .returning({ id: stories.id });
    });
    return updated.length ? { ok: true, id } : { ok: false, error: "notFound" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slugTaken" };
    throw error;
  }
};

export const deleteStory = async (db: Db, id: number): Promise<StoryResult> => {
  const deleted = await db.delete(stories).where(eq(stories.id, id)).returning({ id: stories.id });
  return deleted.length ? { ok: true, id } : { ok: false, error: "notFound" };
};
