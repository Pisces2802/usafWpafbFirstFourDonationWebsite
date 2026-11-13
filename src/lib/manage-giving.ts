import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

import type { Db } from "@/db";
import { donations, donors, subscriptionCancellations } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import {
  type FormError,
  formRequestSchema,
  MANAGE_LINK_MINUTES,
  manageGivingSchema,
} from "@/lib/form-schemas";
import type { TurnstileResult } from "@/lib/turnstile";

const sign = (payload: string, secret: string) =>
  createHmac("sha256", `manage-giving:${secret}`).update(payload).digest("base64url");

/** A signed, expiring reference to one monthly gift, safe to put in an emailed link. */
export const createManageToken = (subscriptionId: string, secret: string, now = new Date()) => {
  const payload = `${subscriptionId}.${now.getTime() + MANAGE_LINK_MINUTES * 60_000}`;
  return `${payload}.${sign(payload, secret)}`;
};

/** The subscription a token refers to, or null when it's malformed, tampered with or expired. */
export const readManageToken = (token: string, secret: string, now = new Date()) => {
  const [subscriptionId, expiresAt, signature, ...rest] = token.split(".");
  if (!subscriptionId || !expiresAt || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(`${subscriptionId}.${expiresAt}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return Number(expiresAt) > now.getTime() ? subscriptionId : null;
};

/** The donor's most recent monthly gift that hasn't ended, if there is one. */
export const findManageableGift = async (db: Db, email: string) => {
  const [gift] = await db
    .select({ subscriptionId: donations.stripeSubscriptionId, firstName: donors.firstName })
    .from(donations)
    .innerJoin(donors, eq(donations.donorId, donors.id))
    .leftJoin(
      subscriptionCancellations,
      eq(subscriptionCancellations.stripeSubscriptionId, donations.stripeSubscriptionId),
    )
    .where(
      and(
        eq(donors.email, email.toLowerCase()),
        eq(donations.frequency, "monthly"),
        isNotNull(donations.stripeSubscriptionId),
        isNull(subscriptionCancellations.stripeSubscriptionId),
      ),
    )
    .orderBy(desc(donations.createdAt))
    .limit(1);

  return gift?.subscriptionId
    ? { subscriptionId: gift.subscriptionId, firstName: gift.firstName }
    : null;
};

export type ManageLinkEmail = {
  locale: Locale;
  donorEmail: string;
  firstName: string;
  url: string;
};

export type ManageGivingDeps = {
  db: Db | null;
  secret: string | undefined;
  /** False when Stripe or email isn't set up, so a link could never be sent or opened. */
  canSend: boolean;
  siteUrl: string;
  isRateLimited: () => boolean;
  verify: (token: string | undefined) => Promise<TurnstileResult>;
  sendLink: (email: ManageLinkEmail) => Promise<void>;
};

type ManageGivingResult =
  { status: 200; body: { ok: true } } | { status: number; body: { error: FormError } };

const fail = (error: FormError, status: number): ManageGivingResult => ({
  status,
  body: { error },
});

/**
 * Handles a request for a manage-giving link. The answer is the same whether or not the address
 * has a monthly gift, so the form can't be used to find out who gives.
 */
export const processManageGivingRequest = async (
  payload: unknown,
  deps: ManageGivingDeps,
): Promise<ManageGivingResult> => {
  if (deps.isRateLimited()) return fail("rate_limited", 429);

  const parsed = formRequestSchema(manageGivingSchema).safeParse(payload);
  if (!parsed.success) return fail("invalid", 400);
  if (!deps.db || !deps.secret || !deps.canSend) return fail("unavailable", 503);

  const verification = await deps.verify(parsed.data.turnstileToken);
  if (verification === "unconfigured") return fail("unavailable", 503);
  if (verification === "failed") return fail("verification_failed", 403);

  const { form, locale } = parsed.data;

  try {
    const gift = await findManageableGift(deps.db, form.email);
    if (gift) {
      const token = createManageToken(gift.subscriptionId, deps.secret);
      const query = new URLSearchParams({ token, locale });
      await deps.sendLink({
        locale,
        donorEmail: form.email.toLowerCase(),
        firstName: gift.firstName,
        url: `${deps.siteUrl}/api/manage-giving?${query}`,
      });
    }
  } catch (error) {
    console.error("Sending a manage-giving link failed", error);
  }

  return { status: 200, body: { ok: true } };
};
