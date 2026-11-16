import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, ne } from "drizzle-orm";

import type { Db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import {
  type FormError,
  formRequestSchema,
  NEWSLETTER_CONFIRM_DAYS,
  newsletterSchema,
} from "@/lib/form-schemas";
import type { TurnstileResult } from "@/lib/turnstile";

type TokenPurpose = "confirm" | "unsubscribe";

/** A second sign-up for the same address within this time doesn't send another email. */
export const CONFIRMATION_COOLDOWN_MS = 10 * 60_000;

const sign = (purpose: TokenPurpose, payload: string, secret: string) =>
  createHmac("sha256", `newsletter-${purpose}:${secret}`).update(payload).digest("base64url");

const createToken = (purpose: TokenPurpose, email: string, expiresAt: number, secret: string) => {
  const payload = `${Buffer.from(email).toString("base64url")}.${expiresAt}`;
  return `${payload}.${sign(purpose, payload, secret)}`;
};

const readToken = (purpose: TokenPurpose, token: string, secret: string, now: Date) => {
  const [encodedEmail, expiresAt, signature, ...rest] = token.split(".");
  if (!encodedEmail || !expiresAt || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(purpose, `${encodedEmail}.${expiresAt}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const expires = Number(expiresAt);
  if (expires !== 0 && !(expires > now.getTime())) return null;
  return Buffer.from(encodedEmail, "base64url").toString("utf8");
};

/** A signed link token proving someone can read `email`'s inbox; works for a week. */
export const createConfirmToken = (email: string, secret: string, now = new Date()) =>
  createToken("confirm", email, now.getTime() + NEWSLETTER_CONFIRM_DAYS * 86_400_000, secret);

export const readConfirmToken = (token: string, secret: string, now = new Date()) =>
  readToken("confirm", token, secret, now);

/**
 * A signed token that unsubscribes `email`. It never expires, so it can go in every email the
 * group sends (the subscriber CSV carries each person's link for a mailing tool).
 */
export const createUnsubscribeToken = (email: string, secret: string) =>
  createToken("unsubscribe", email, 0, secret);

export const readUnsubscribeToken = (token: string, secret: string, now = new Date()) =>
  readToken("unsubscribe", token, secret, now);

export type NewsletterConfirmEmail = { locale: Locale; email: string; url: string };

export type NewsletterSignupDeps = {
  db: Db | null;
  secret: string | undefined;
  /** False when email isn't set up, so a confirmation could never arrive. */
  canSend: boolean;
  /** The localised /newsletter page, absolute, without a query. */
  pageUrl: (locale: Locale) => string;
  isRateLimited: () => boolean | Promise<boolean>;
  verify: (token: string | undefined) => Promise<TurnstileResult>;
  sendConfirmation: (email: NewsletterConfirmEmail) => Promise<void>;
  now?: () => Date;
};

type NewsletterSignupResult =
  { status: 200; body: { ok: true } } | { status: number; body: { error: FormError } };

const fail = (error: FormError, status: number): NewsletterSignupResult => ({
  status,
  body: { error },
});

/**
 * Handles a newsletter sign-up: records the address as pending and emails a confirmation link.
 * The answer is the same whether the address is new, pending or already subscribed, so the form
 * can't be used to find out who's on the list. Nobody is subscribed until they confirm.
 */
export const processNewsletterSignup = async (
  payload: unknown,
  deps: NewsletterSignupDeps,
): Promise<NewsletterSignupResult> => {
  if (await deps.isRateLimited()) return fail("rate_limited", 429);

  const parsed = formRequestSchema(newsletterSchema).safeParse(payload);
  if (!parsed.success) return fail("invalid", 400);
  if (!deps.db || !deps.secret || !deps.canSend) return fail("unavailable", 503);

  const verification = await deps.verify(parsed.data.turnstileToken);
  if (verification === "unconfigured") return fail("unavailable", 503);
  if (verification === "failed") return fail("verification_failed", 403);

  const { db, secret } = deps;
  const { locale } = parsed.data;
  const email = parsed.data.form.email.toLowerCase();
  const now = deps.now?.() ?? new Date();

  try {
    const [existing] = await db
      .select({
        status: newsletterSubscribers.status,
        confirmationSentAt: newsletterSubscribers.confirmationSentAt,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email));

    const recentlySent =
      existing?.confirmationSentAt &&
      now.getTime() - existing.confirmationSentAt.getTime() < CONFIRMATION_COOLDOWN_MS;
    if (existing?.status === "subscribed" || recentlySent)
      return { status: 200, body: { ok: true } };

    // Someone who unsubscribed stays unsubscribed until they confirm again.
    await db
      .insert(newsletterSubscribers)
      .values({ email, locale })
      .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { locale } });

    const query = new URLSearchParams({ confirm: createConfirmToken(email, secret, now) });
    await deps.sendConfirmation({ locale, email, url: `${deps.pageUrl(locale)}?${query}` });
    await db
      .update(newsletterSubscribers)
      .set({ confirmationSentAt: now })
      .where(eq(newsletterSubscribers.email, email));
  } catch (error) {
    console.error("Newsletter sign-up failed", error);
    return fail("failed", 502);
  }

  return { status: 200, body: { ok: true } };
};

export type NewsletterLinkResult = "confirmed" | "unsubscribed" | "invalid";

/** Subscribes the address in a confirmation link. Following the link twice is fine. */
export const confirmSubscription = async (
  db: Db,
  token: string,
  secret: string,
  now = new Date(),
): Promise<NewsletterLinkResult> => {
  const email = readConfirmToken(token, secret, now);
  if (!email) return "invalid";

  const updated = await db
    .update(newsletterSubscribers)
    .set({ status: "subscribed", confirmedAt: now, unsubscribedAt: null })
    .where(
      and(eq(newsletterSubscribers.email, email), ne(newsletterSubscribers.status, "subscribed")),
    )
    .returning({ id: newsletterSubscribers.id });
  if (updated.length > 0) return "confirmed";

  // Already subscribed (a second click) is fine; an address that's gone isn't.
  const [existing] = await db
    .select({ id: newsletterSubscribers.id })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email));
  return existing ? "confirmed" : "invalid";
};

/**
 * Unsubscribes the address in an unsubscribe link. Always reports success for a valid link,
 * including when the address was never on the list or already left.
 */
export const unsubscribe = async (
  db: Db,
  token: string,
  secret: string,
  now = new Date(),
): Promise<NewsletterLinkResult> => {
  const email = readUnsubscribeToken(token, secret, now);
  if (!email) return "invalid";

  await db
    .update(newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: now })
    .where(
      and(eq(newsletterSubscribers.email, email), ne(newsletterSubscribers.status, "unsubscribed")),
    );

  return "unsubscribed";
};
