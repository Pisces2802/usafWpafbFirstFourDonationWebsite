import { getTranslations } from "next-intl/server";
import type Stripe from "stripe";

import { type CheckoutError, checkoutRequestSchema } from "@/lib/donation-schema";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getPathname } from "@/i18n/navigation";
import { siteConfig } from "@/config/site";
import { grossUpCents } from "@/lib/fees";
import { getStripe } from "@/lib/stripe";
import { env } from "@/env";

const STRIPE_LOCALES = { en: "en", es: "es-419", fr: "fr" } as const;

const fail = (error: CheckoutError, status: number) => Response.json({ error }, { status });

/**
 * Creates an embedded Stripe Checkout Session for a gift and returns its client secret. Amount
 * bounds and the card-fee top-up are recomputed here; client totals are never trusted.
 */
export const POST = async (request: Request) => {
  const ip = getClientIp(request.headers);
  if (isRateLimited(`checkout:${ip ?? "unknown"}`, { limit: 5, windowMs: 60_000 })) {
    return fail("rate_limited", 429);
  }

  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid", 400);

  const stripe = getStripe();
  if (!stripe) return fail("unavailable", 503);

  const verification = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (verification === "unconfigured") return fail("unavailable", 503);
  if (verification === "failed") return fail("verification_failed", 403);

  const { donation, locale } = parsed.data;
  const { feeCents } = grossUpCents(donation.amountCents, {
    pct: env.STRIPE_PCT_FEE,
    fixedCents: env.STRIPE_FIXED_FEE_CENTS,
  });
  const chargedCents = donation.coverFees ? donation.amountCents + feeCents : donation.amountCents;

  const t = await getTranslations({ locale, namespace: "Checkout" });
  const tFunds = await getTranslations({ locale, namespace: "Funds" });
  const isMonthly = donation.frequency === "monthly";

  const metadata: Stripe.MetadataParam = {
    fundId: donation.fundId,
    amountCents: String(donation.amountCents),
    coverFees: String(donation.coverFees),
    feeCoveredCents: String(donation.coverFees ? feeCents : 0),
    tributeType: donation.tribute?.type ?? "",
    honoreeName: donation.tribute?.honoreeName ?? "",
    tributeNotifyEmail: donation.tribute?.notifyEmail ?? "",
    donorFirstName: donation.donor.firstName,
    donorLastName: donation.donor.lastName,
    campaign: donation.campaign ?? "",
    locale,
  };

  const returnPath = getPathname({ locale, href: "/donate/thank-you" });
  const productName = t("productName", {
    orgName: siteConfig.orgName,
    fund: tFunds(`${donation.fundId}.name`),
  });

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      return_url: `${env.NEXT_PUBLIC_SITE_URL}${returnPath}?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: donation.donor.email,
      locale: STRIPE_LOCALES[locale],
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: chargedCents,
            product_data: { name: productName },
            ...(isMonthly && { recurring: { interval: "month" as const } }),
          },
        },
      ],
      ...(isMonthly
        ? { mode: "subscription", subscription_data: { metadata } }
        : {
            mode: "payment",
            submit_type: "donate",
            customer_creation: "always",
            payment_intent_data: { metadata, description: productName },
          }),
    });

    if (!session.client_secret) return fail("failed", 502);
    return Response.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Stripe checkout session failed", error);
    return fail("failed", 502);
  }
};
