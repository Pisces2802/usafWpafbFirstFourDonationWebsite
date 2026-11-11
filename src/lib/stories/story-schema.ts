import { z } from "zod";

import { FUND_IDS } from "@/config/donation";
import { type Locale, routing } from "@/i18n/routing";

export const STORY_STATUSES = ["draft", "published"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

/** English is required; the other languages are optional and fall back to it. */
export const STORY_SOURCE_LOCALE = routing.defaultLocale;
export const STORY_LOCALES = routing.locales;

/** The plain-text fields of one language's version, in the order the form shows them. */
export const STORY_TEXT_FIELDS = ["title", "name", "role", "summary", "quote"] as const;
export type StoryTextField = (typeof STORY_TEXT_FIELDS)[number];

export const STORY_FIELD_LIMITS: Record<StoryTextField | "body", number> = {
  title: 160,
  name: 80,
  role: 120,
  summary: 400,
  quote: 300,
  body: 200_000,
};

/** One language's version of a story. `body` is HTML. */
export type StoryLocaleContent = Record<StoryTextField | "body", string>;

/** What's stored: English, plus whichever other languages have been written. */
export type StoryContent = { en: StoryLocaleContent } & Partial<Record<Locale, StoryLocaleContent>>;

export const storySlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

/** Whether editor HTML has anything in it: text or an image. */
export const hasBodyContent = (html: string) =>
  /<img\s/i.test(html) ||
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .trim().length > 0;

const isFilled = (content: StoryLocaleContent, field: StoryTextField | "body") =>
  field === "body" ? hasBodyContent(content.body) : content[field].trim().length > 0;

const STORY_FIELDS = [...STORY_TEXT_FIELDS, "body"] as const;

/** Whether a language's version has been started at all. */
export const isLocaleStarted = (content: StoryLocaleContent) =>
  STORY_FIELDS.some((field) => isFilled(content, field));

const localeContentSchema = z.object({
  title: z.string().trim().max(STORY_FIELD_LIMITS.title),
  name: z.string().trim().max(STORY_FIELD_LIMITS.name),
  role: z.string().trim().max(STORY_FIELD_LIMITS.role),
  summary: z.string().trim().max(STORY_FIELD_LIMITS.summary),
  quote: z.string().trim().max(STORY_FIELD_LIMITS.quote),
  body: z.string().max(STORY_FIELD_LIMITS.body),
});

/**
 * Shared by the story form and its server actions. Every English field is required. Spanish and
 * French are either left empty, so the site shows English, or filled in completely.
 */
export const storyFormSchema = z
  .object({
    slug: z.string().trim().toLowerCase().pipe(storySlugSchema),
    fundId: z.enum(FUND_IDS),
    publishedOn: z.iso.date(),
    status: z.enum(STORY_STATUSES),
    isFeatured: z.boolean(),
    isSample: z.boolean(),
    content: z.object(
      Object.fromEntries(STORY_LOCALES.map((locale) => [locale, localeContentSchema])) as Record<
        Locale,
        typeof localeContentSchema
      >,
    ),
  })
  .superRefine((values, context) => {
    for (const locale of STORY_LOCALES) {
      const content = values.content[locale];
      const required = locale === STORY_SOURCE_LOCALE || isLocaleStarted(content);
      if (!required) continue;
      for (const field of STORY_FIELDS) {
        if (isFilled(content, field)) continue;
        context.addIssue({
          code: "custom",
          path: ["content", locale, field],
          message: locale === STORY_SOURCE_LOCALE ? "required" : "incomplete",
        });
      }
    }
  });

export type StoryFormInput = z.input<typeof storyFormSchema>;
export type StoryFormValues = z.output<typeof storyFormSchema>;

export const EMPTY_LOCALE_CONTENT: StoryLocaleContent = {
  title: "",
  name: "",
  role: "",
  summary: "",
  quote: "",
  body: "",
};

/** A stored story's content as form values, with blanks for languages not written yet. */
export const toFormContent = (content: StoryContent | null): StoryFormInput["content"] =>
  Object.fromEntries(
    STORY_LOCALES.map((locale) => [locale, { ...EMPTY_LOCALE_CONTENT, ...content?.[locale] }]),
  ) as StoryFormInput["content"];

/** "The cookout that made the dorms…" → "the-cookout-that-made-the-dorms". */
export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

/** Reasons a story change can be refused, keyed into `Admin.stories.errors`. */
export const STORY_ERRORS = ["invalid", "slugTaken", "notFound", "noDatabase"] as const;
export type StoryError = (typeof STORY_ERRORS)[number];
export type StoryResult = { ok: true; id: number } | { ok: false; error: StoryError };

/** Images the editor accepts, and how big they can be. */
export const STORY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const STORY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Cloudinary's names for the same formats, which uploads are signed to allow. */
export const STORY_IMAGE_FORMATS = "jpg,png,webp,gif";
export const STORY_IMAGE_FOLDER = "stories";
