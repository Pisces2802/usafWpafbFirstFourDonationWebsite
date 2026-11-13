import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";
import { isEmailConfigured, sendManageGivingLink } from "@/lib/emails";
import { processManageGivingRequest, readManageToken } from "@/lib/manage-giving";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { getStripe, STRIPE_LOCALES } from "@/lib/stripe";
import { verifyTurnstile } from "@/lib/turnstile";

const pageUrl = (locale: Locale, href: "/" | "/manage-giving") =>
  `${env.NEXT_PUBLIC_SITE_URL}${getPathname({ locale, href })}`;

/** Emails a manage-giving link when the address has a monthly gift. Always answers the same. */
export const POST = async (request: Request) => {
  const ip = getClientIp(request.headers);

  const { status, body } = await processManageGivingRequest(
    await request.json().catch(() => null),
    {
      db: getDb(),
      secret: env.AUTH_SECRET,
      canSend: isEmailConfigured() && getStripe() !== null,
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
      isRateLimited: () =>
        isRateLimited(`manage-giving:${ip ?? "unknown"}`, { limit: 5, windowMs: 10 * 60_000 }),
      verify: (token) => verifyTurnstile(token, ip),
      sendLink: sendManageGivingLink,
    },
  );

  return Response.json(body, { status });
};

/**
 * The emailed link. Checks the signed token, then sends the donor to a Stripe billing portal
 * session for the customer behind that monthly gift. A bad or expired link goes back to the form.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const localeParam = searchParams.get("locale");
  const locale = hasLocale(routing.locales, localeParam) ? localeParam : routing.defaultLocale;
  const backToForm = (reason: "expired" | "failed") =>
    Response.redirect(`${pageUrl(locale, "/manage-giving")}?link=${reason}`, 303);

  const ip = getClientIp(request.headers);
  if (isRateLimited(`manage-giving-open:${ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 })) {
    return backToForm("failed");
  }

  const stripe = getStripe();
  if (!stripe || !env.AUTH_SECRET) return backToForm("failed");

  const subscriptionId = readManageToken(searchParams.get("token") ?? "", env.AUTH_SECRET);
  if (!subscriptionId) return backToForm("expired");

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customer =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const session = await stripe.billingPortal.sessions.create({
      customer,
      locale: STRIPE_LOCALES[locale],
      return_url: pageUrl(locale, "/"),
    });
    return Response.redirect(session.url, 303);
  } catch (error) {
    console.error("Opening the billing portal failed", error);
    return backToForm("failed");
  }
};
