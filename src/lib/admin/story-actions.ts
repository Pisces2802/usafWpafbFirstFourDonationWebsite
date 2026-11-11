"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { type Db, getDb } from "@/db";
import { type AdminUser, requireAdmin } from "@/lib/admin/access";
import { type AuditDetails, recordAudit } from "@/lib/admin/audit";
import {
  createStory as insertStory,
  deleteStory as removeStory,
  findStory,
  type StoryRecord,
  updateStory as saveStory,
} from "@/lib/admin/story-queries";
import { STORIES_TAG } from "@/lib/stories/queries";
import { sanitizeStoryHtml } from "@/lib/stories/sanitize";
import {
  hasBodyContent,
  isLocaleStarted,
  STORY_LOCALES,
  STORY_SOURCE_LOCALE,
  type StoryContent,
  storyFormSchema,
  type StoryResult,
} from "@/lib/stories/story-schema";

const idSchema = z.number().int().positive();

/**
 * Runs a story change. Inputs come straight from the client, so each action re-checks the
 * permission and validates every argument before touching the database. On success the public
 * story pages are refreshed.
 */
const storyChange = async (
  run: (db: Db, actor: AdminUser) => Promise<StoryResult>,
): Promise<StoryResult> => {
  const actor = await requireAdmin("stories:manage");
  const db = getDb();
  if (!db) return { ok: false, error: "noDatabase" };

  const result = await run(db, actor);
  if (result.ok) {
    updateTag(STORIES_TAG);
    refresh();
  }
  return result;
};

/**
 * Validates the form and turns it into what's stored: sanitised bodies, and only the languages
 * that have been written. Null when anything is invalid, including a body that's empty once
 * cleaned.
 */
const toRecord = (input: unknown): StoryRecord | null => {
  const parsed = storyFormSchema.safeParse(input);
  if (!parsed.success) return null;
  const { content, ...values } = parsed.data;

  const stored: Partial<StoryContent> = {};
  for (const locale of STORY_LOCALES) {
    const version = content[locale];
    if (locale !== STORY_SOURCE_LOCALE && !isLocaleStarted(version)) continue;
    const body = sanitizeStoryHtml(version.body);
    if (!hasBodyContent(body)) return null;
    stored[locale] = { ...version, body };
  }
  if (!stored.en) return null;
  return { ...values, content: stored as StoryContent };
};

const summarize = (record: StoryRecord): AuditDetails => ({
  status: record.status,
  fund: record.fundId,
  languages: STORY_LOCALES.filter((locale) => record.content[locale]).join(", "),
});

export const createStory = async (input: unknown): Promise<StoryResult> => {
  const record = toRecord(input);
  if (!record) return { ok: false, error: "invalid" };
  return storyChange(async (db, actor) => {
    const result = await insertStory(db, record, actor.id);
    if (result.ok) {
      await recordAudit(db, {
        actor,
        action: "story.created",
        target: record.slug,
        details: summarize(record),
      });
    }
    return result;
  });
};

export const updateStory = async (id: unknown, input: unknown): Promise<StoryResult> => {
  const parsedId = idSchema.safeParse(id);
  const record = toRecord(input);
  if (!parsedId.success || !record) return { ok: false, error: "invalid" };
  return storyChange(async (db, actor) => {
    const before = await findStory(db, parsedId.data);
    if (!before) return { ok: false, error: "notFound" };
    const result = await saveStory(db, parsedId.data, record, actor.id);
    if (result.ok) {
      const changes: AuditDetails = {};
      if (before.slug !== record.slug) changes.slug = record.slug;
      if (before.status !== record.status) changes.status = record.status;
      if (before.fundId !== record.fundId) changes.fund = record.fundId;
      if (before.isFeatured !== record.isFeatured) changes.featured = record.isFeatured;
      if (JSON.stringify(before.content) !== JSON.stringify(record.content)) {
        changes.languages = summarize(record).languages ?? null;
      }
      await recordAudit(db, {
        actor,
        action: "story.updated",
        target: before.slug,
        details: changes,
      });
    }
    return result;
  });
};

export const deleteStory = async (id: unknown): Promise<StoryResult> => {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  return storyChange(async (db, actor) => {
    const before = await findStory(db, parsedId.data);
    const result = await removeStory(db, parsedId.data);
    if (result.ok && before) {
      await recordAudit(db, { actor, action: "story.deleted", target: before.slug });
    }
    return result;
  });
};
