import "server-only";

import { eq } from "drizzle-orm";
import { hasLocale } from "next-intl";
import type Stripe from "stripe";

import { type Frequency, isFundId } from "@/config/donation";
import type { Tx } from "@/db";
import { campaigns, donations, donors, funds } from "@/db/schema";
import { routing } from "@/i18n/routing";
import type { GiftEmailData } from "@/lib/emails";

type GiftPlan = {
  kind: "gift";
  stripeCustomerId: string | null;
  campaignSlug: string | null;
  email: GiftEmailData;
  sendTributeNotice: boolean;
  stripe: {
    sessionId: string | null;
    paymentIntentId: string | null;
    subscriptionId: string | null;
    invoiceId: string | null;
  };
};

type RefundPlan = {
  kind: "refund";
  paymentIntentId: string;
  refundedCents: number;
  isFullRefund: boolean;
};

export type WebhookPlan = GiftPlan | RefundPlan;

const isTributeType = (value: unknown): value is "honour" | "memory" =>
  value === "honour" || value === "memory";

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

const cardLast4 = (charge: string | Stripe.Charge | null | undefined) =>
  typeof charge === "object" && charge
    ? (charge.payment_method_details?.card?.last4 ?? null)
    : null;

/** Reads the metadata `POST /api/checkout` attaches; null for payments this site didn't create. */
const readGiftMetadata = (metadata: Stripe.Metadata | null | undefined, chargedCents: number) => {
  if (!metadata?.fundId) return null;

  const feeCoveredCents = Number(metadata.feeCoveredCents) || 0;
  const amountCents = Number(metadata.amountCents) || chargedCents - feeCoveredCents;
  const tributeType = metadata.tributeType;

  return {
    fundId: isFundId(metadata.fundId) ? metadata.fundId : "general",
    amountCents,
    feeCoveredCents,
    firstName: metadata.donorFirstName ?? "",
    lastName: metadata.donorLastName ?? "",
    campaignSlug: metadata.campaign || null,
    locale: hasLocale(routing.locales, metadata.locale) ? metadata.locale : routing.defaultLocale,
    tribute:
      isTributeType(tributeType) && metadata.honoreeName
        ? {
            type: tributeType,
            honoreeName: metadata.honoreeName,
            notifyEmail: metadata.tributeNotifyEmail || null,
          }
        : null,
  } as const;
};

const buildGiftPlan = ({
  metadata,
  frequency,
  donorEmail,
  paidAt,
  last4,
  reference,
  stripeCustomerId,
  sendTributeNotice,
  stripe,
}: {
  metadata: NonNullable<ReturnType<typeof readGiftMetadata>>;
  frequency: Frequency;
  donorEmail: string;
  paidAt: Date;
  last4: string | null;
  reference: string;
  stripeCustomerId: string | null;
  sendTributeNotice: boolean;
  stripe: GiftPlan["stripe"];
}): GiftPlan => ({
  kind: "gift",
  stripeCustomerId,
  campaignSlug: metadata.campaignSlug,
  sendTributeNotice,
  stripe,
  email: {
    locale: metadata.locale,
    donorEmail: donorEmail.toLowerCase(),
    firstName: metadata.firstName,
    lastName: metadata.lastName,
    frequency,
    fundId: metadata.fundId,
    amountCents: metadata.amountCents,
    feeCoveredCents: metadata.feeCoveredCents,
    paidAt,
    cardLast4: last4,
    reference,
    tribute: metadata.tribute,
  },
});

/** One-time gifts. Monthly gifts are recorded per paid invoice instead, so they're skipped here. */
const planFromCheckoutSession = async (
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  paidAt: Date,
): Promise<WebhookPlan | null> => {
  if (session.mode !== "payment" || session.payment_status !== "paid") return null;

  const metadata = readGiftMetadata(session.metadata, session.amount_total ?? 0);
  const paymentIntentId = idOf(session.payment_intent);
  const donorEmail = session.customer_details?.email ?? session.customer_email;
  if (!metadata || !paymentIntentId || !donorEmail) return null;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  return buildGiftPlan({
    metadata,
    frequency: "one_time",
    donorEmail,
    paidAt,
    last4: cardLast4(paymentIntent.latest_charge),
    reference: paymentIntentId,
    stripeCustomerId: idOf(session.customer),
    sendTributeNotice: true,
    stripe: {
      sessionId: session.id,
      paymentIntentId,
      subscriptionId: null,
      invoiceId: null,
    },
  });
};

/** Each paid monthly instalment, including the first. */
const planFromInvoice = async (
  stripe: Stripe,
  invoice: Stripe.Invoice,
  paidAt: Date,
): Promise<WebhookPlan | null> => {
  const subscription = invoice.parent?.subscription_details;
  const metadata = readGiftMetadata(subscription?.metadata, invoice.amount_paid);
  const donorEmail = invoice.customer_email;
  if (!subscription || !metadata || !donorEmail) return null;

  const payments = await stripe.invoicePayments.list({
    invoice: invoice.id,
    status: "paid",
    expand: ["data.payment.payment_intent.latest_charge"],
  });
  const paymentIntent = payments.data[0]?.payment.payment_intent;
  const latestCharge = typeof paymentIntent === "object" ? paymentIntent.latest_charge : null;

  return buildGiftPlan({
    metadata,
    frequency: "monthly",
    donorEmail,
    paidAt,
    last4: cardLast4(latestCharge),
    reference: invoice.number ?? invoice.id,
    stripeCustomerId: idOf(invoice.customer),
    sendTributeNotice: invoice.billing_reason === "subscription_create",
    stripe: {
      sessionId: null,
      paymentIntentId: idOf(paymentIntent),
      subscriptionId: idOf(subscription.subscription),
      invoiceId: invoice.id,
    },
  });
};

/**
 * Turns a Stripe event into the database change it implies, using only Stripe API calls so the
 * database transaction that follows stays short. Returns null for events with nothing to record.
 */
export const planWebhookEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<WebhookPlan | null> => {
  const occurredAt = new Date(event.created * 1000);

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return planFromCheckoutSession(stripe, event.data.object, occurredAt);
    case "invoice.paid":
      return planFromInvoice(stripe, event.data.object, occurredAt);
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      return paymentIntentId
        ? {
            kind: "refund",
            paymentIntentId,
            refundedCents: charge.amount_refunded,
            isFullRefund: charge.refunded,
          }
        : null;
    }
    default:
      return null;
  }
};

const ensureFundId = async (tx: Tx, slug: string) => {
  await tx.insert(funds).values({ slug }).onConflictDoNothing();
  const [fund] = await tx.select({ id: funds.id }).from(funds).where(eq(funds.slug, slug));
  return fund.id;
};

const findCampaignId = async (tx: Tx, slug: string | null) => {
  if (!slug) return null;
  const [campaign] = await tx
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, slug));
  return campaign?.id ?? null;
};

/**
 * Writes a plan inside the caller's transaction. Returns the gift whose emails should go out, or
 * null when nothing new was recorded (a refund, or a gift already on file).
 */
export const applyWebhookPlan = async (tx: Tx, plan: WebhookPlan) => {
  if (plan.kind === "refund") {
    await tx
      .update(donations)
      .set({
        refundedCents: plan.refundedCents,
        status: plan.isFullRefund ? "refunded" : "succeeded",
      })
      .where(eq(donations.stripePaymentIntentId, plan.paymentIntentId));
    return null;
  }

  const { email } = plan;
  const [donor] = await tx
    .insert(donors)
    .values({
      email: email.donorEmail,
      firstName: email.firstName,
      lastName: email.lastName,
      stripeCustomerId: plan.stripeCustomerId,
      locale: email.locale,
    })
    .onConflictDoUpdate({
      target: donors.email,
      set: {
        firstName: email.firstName,
        lastName: email.lastName,
        locale: email.locale,
        ...(plan.stripeCustomerId && { stripeCustomerId: plan.stripeCustomerId }),
      },
    })
    .returning({ id: donors.id });

  const inserted = await tx
    .insert(donations)
    .values({
      donorId: donor.id,
      campaignId: await findCampaignId(tx, plan.campaignSlug),
      fundId: await ensureFundId(tx, email.fundId),
      amountCents: email.amountCents,
      feeCoveredCents: email.feeCoveredCents,
      frequency: email.frequency,
      status: "succeeded",
      stripeSessionId: plan.stripe.sessionId,
      stripePaymentIntentId: plan.stripe.paymentIntentId,
      stripeSubscriptionId: plan.stripe.subscriptionId,
      stripeInvoiceId: plan.stripe.invoiceId,
      tributeType: email.tribute?.type ?? null,
      honoreeName: email.tribute?.honoreeName ?? null,
      locale: email.locale,
      createdAt: email.paidAt,
    })
    .onConflictDoNothing()
    .returning({ id: donations.id });

  return inserted.length > 0 ? plan : null;
};
