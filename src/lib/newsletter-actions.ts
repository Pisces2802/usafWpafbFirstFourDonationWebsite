"use server";

import { headers } from "next/headers";

import { getDb } from "@/db";
import { env } from "@/env";
import { confirmSubscription, type NewsletterLinkResult, unsubscribe } from "@/lib/newsletter";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

export type NewsletterLinkState = NewsletterLinkResult | "failed" | null;

/**
 * Runs the confirm or unsubscribe link from an email. The page asks for a button press first, so
 * mail scanners that open links don't confirm or unsubscribe anyone by themselves.
 */
export const applyNewsletterLink = async (
  _previous: NewsletterLinkState,
  formData: FormData,
): Promise<NewsletterLinkState> => {
  const action = formData.get("action");
  const token = formData.get("token");
  if ((action !== "confirm" && action !== "unsubscribe") || typeof token !== "string") {
    return "invalid";
  }

  const ip = getClientIp(await headers());
  if (await isRateLimited(`newsletter-link:${ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 })) {
    return "failed";
  }

  const db = getDb();
  if (!db || !env.AUTH_SECRET) return "failed";

  try {
    return action === "confirm"
      ? await confirmSubscription(db, token, env.AUTH_SECRET)
      : await unsubscribe(db, token, env.AUTH_SECRET);
  } catch (error) {
    console.error("Applying a newsletter link failed", error);
    return "failed";
  }
};
