import { revalidateTag } from "next/cache";
import type Stripe from "stripe";

import { getDb } from "@/db";
import { stripeEvents } from "@/db/schema";
import { env } from "@/env";
import { CAMPAIGN_PROGRESS_TAG } from "@/lib/campaign-progress";
import { sendReceipt, sendTributeNotice } from "@/lib/emails";
import { getStripe } from "@/lib/stripe";
import { applyWebhookPlan, planWebhookEvent } from "@/lib/stripe-webhook";

/**
 * Records gifts and refunds from Stripe. Each event id is stored in the same transaction as its
 * changes, so retries and duplicate deliveries are skipped, and a failed write is retried by Stripe.
 * Emails go out only after the transaction commits.
 */
export const POST = async (request: Request) => {
  const stripe = getStripe();
  const db = getDb();
  if (!stripe || !db || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "invalid_signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    const plan = await planWebhookEvent(stripe, event);

    const recorded = await db.transaction(async (tx) => {
      const [isNew] = await tx
        .insert(stripeEvents)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ id: stripeEvents.id });

      if (!isNew || !plan) return { isNew: Boolean(isNew), gift: null };
      return { isNew: true, gift: await applyWebhookPlan(tx, plan) };
    });

    if (recorded.isNew && plan) revalidateTag(CAMPAIGN_PROGRESS_TAG, "max");

    if (recorded.gift) {
      const { email, sendTributeNotice: shouldNotify } = recorded.gift;
      const results = await Promise.allSettled([
        sendReceipt(email),
        shouldNotify ? sendTributeNotice(email) : Promise.resolve(),
      ]);
      for (const result of results) {
        if (result.status === "rejected")
          console.error("Gift email failed", event.id, result.reason);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", event.id, event.type, error);
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
};
