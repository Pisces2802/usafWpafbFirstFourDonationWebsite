import "server-only";

import { getTranslations } from "next-intl/server";
import type { z } from "zod";

import type { Db } from "@/db";
import { contactMessages, volunteers } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import { sendOrgNotice } from "@/lib/emails";
import {
  type ContactMessage,
  type FormError,
  formRequestSchema,
  type Volunteer,
} from "@/lib/form-schemas";
import type { TurnstileResult } from "@/lib/turnstile";

export const saveVolunteer = (db: Db, volunteer: Volunteer, locale: Locale) =>
  db.insert(volunteers).values({
    name: volunteer.name,
    email: volunteer.email,
    phone: volunteer.phone ?? null,
    affiliation: volunteer.affiliation,
    interests: volunteer.interests,
    availability: volunteer.availability ?? null,
    locale,
  });

export const saveContactMessage = (db: Db, message: ContactMessage, locale: Locale) =>
  db.insert(contactMessages).values({ ...message, locale });

export const notifyVolunteer = async (volunteer: Volunteer, locale: Locale) => {
  const t = await getTranslations({ locale: "en", namespace: "Emails" });
  const tForms = await getTranslations({ locale: "en", namespace: "Forms" });

  await sendOrgNotice({
    subject: t("volunteerNoticeSubject", { name: volunteer.name }),
    heading: t("volunteerNoticeHeading"),
    replyTo: volunteer.email,
    rows: [
      { label: t("rowName"), value: volunteer.name },
      { label: t("rowEmail"), value: volunteer.email },
      ...(volunteer.phone ? [{ label: t("rowPhone"), value: volunteer.phone }] : []),
      {
        label: t("rowAffiliation"),
        value: tForms(`affiliations.${volunteer.affiliation}`),
      },
      {
        label: t("rowInterests"),
        value: volunteer.interests.map((interest) => tForms(`interests.${interest}`)).join(", "),
      },
      { label: t("rowLanguage"), value: locale.toUpperCase() },
    ],
    paragraphs: volunteer.availability
      ? [`${t("rowAvailability")}: ${volunteer.availability}`]
      : [],
    notes: [t("noticeReplyNote", { name: volunteer.name })],
  });
};

export const notifyContactMessage = async (message: ContactMessage, locale: Locale) => {
  const t = await getTranslations({ locale: "en", namespace: "Emails" });
  const tForms = await getTranslations({ locale: "en", namespace: "Forms" });
  const topic = tForms(`topics.${message.topic}`);

  await sendOrgNotice({
    subject: t("contactNoticeSubject", { topic, name: message.name }),
    heading: topic,
    replyTo: message.email,
    rows: [
      { label: t("rowName"), value: message.name },
      { label: t("rowEmail"), value: message.email },
      { label: t("rowLanguage"), value: locale.toUpperCase() },
    ],
    paragraphs: message.message.split(/\n{2,}/),
    notes: [t("noticeReplyNote", { name: message.name })],
  });
};

export type FormSubmissionDeps<T> = {
  db: Db | null;
  canNotify: boolean;
  isRateLimited: () => boolean;
  verify: (token: string | undefined) => Promise<TurnstileResult>;
  save: (db: Db, data: T, locale: Locale) => Promise<unknown>;
  notify: (data: T, locale: Locale) => Promise<void>;
};

export type FormSubmissionResult =
  { status: 200; body: { ok: true } } | { status: number; body: { error: FormError } };

const fail = (error: FormError, status: number): FormSubmissionResult => ({
  status,
  body: { error },
});

/**
 * Runs a volunteer or contact submission: rate limit, validate, Turnstile, save, then email the
 * group. Accepted when it's stored or, without a database, when the email went out; nothing is
 * reported as sent unless one of those happened.
 */
export const processFormSubmission = async <T>(
  payload: unknown,
  schema: z.ZodType<T>,
  deps: FormSubmissionDeps<T>,
): Promise<FormSubmissionResult> => {
  if (deps.isRateLimited()) return fail("rate_limited", 429);

  const parsed = formRequestSchema(schema).safeParse(payload);
  if (!parsed.success) return fail("invalid", 400);
  if (!deps.db && !deps.canNotify) return fail("unavailable", 503);

  const verification = await deps.verify(parsed.data.turnstileToken);
  if (verification === "unconfigured") return fail("unavailable", 503);
  if (verification === "failed") return fail("verification_failed", 403);

  const { form, locale } = parsed.data;
  const data = form as T;

  if (deps.db) {
    try {
      await deps.save(deps.db, data, locale);
    } catch (error) {
      console.error("Saving form submission failed", error);
      return fail("failed", 502);
    }
  }

  if (deps.canNotify) {
    try {
      await deps.notify(data, locale);
    } catch (error) {
      console.error("Emailing form submission failed", error);
      if (!deps.db) return fail("failed", 502);
    }
  }

  return { status: 200, body: { ok: true } };
};
