import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";

import type { Tx } from "@/db";
import * as schema from "@/db/schema";
import { applyWebhookPlan, planWebhookEvent } from "@/lib/stripe-webhook";

const metadata = {
  fundId: "emergency",
  amountCents: "7500",
  coverFees: "true",
  feeCoveredCents: "255",
  tributeType: "memory",
  honoreeName: "Jo Rivera",
  tributeNotifyEmail: "family@example.com",
  donorFirstName: "Sam",
  donorLastName: "Lee",
  campaign: "giving-day",
  locale: "fr",
};

const fakeStripe = {
  paymentIntents: {
    retrieve: async () => ({
      latest_charge: { payment_method_details: { card: { last4: "4242" } } },
    }),
  },
  invoicePayments: {
    list: async () => ({
      data: [
        {
          payment: {
            payment_intent: {
              id: "pi_invoice_1",
              latest_charge: { payment_method_details: { card: { last4: "1881" } } },
            },
          },
        },
      ],
    }),
  },
} as unknown as Stripe;

const event = (type: string, object: object, id = `evt_${type}`) =>
  ({ id, type, created: 1_790_000_000, data: { object } }) as unknown as Stripe.Event;

const checkoutCompleted = event("checkout.session.completed", {
  id: "cs_test_1",
  mode: "payment",
  payment_status: "paid",
  amount_total: 7755,
  payment_intent: "pi_1",
  customer: "cus_1",
  customer_email: "Sam@Example.com",
  customer_details: { email: "Sam@Example.com" },
  metadata,
});

const createDb = async () => {
  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
};

type TestDb = Awaited<ReturnType<typeof createDb>>;
const asTx = (db: TestDb) => db as unknown as Tx;

describe("planWebhookEvent", () => {
  it("plans a one-time gift from a paid checkout session", async () => {
    const plan = await planWebhookEvent(fakeStripe, checkoutCompleted);

    expect(plan).toMatchObject({
      kind: "gift",
      campaignSlug: "giving-day",
      sendTributeNotice: true,
      email: {
        donorEmail: "sam@example.com",
        locale: "fr",
        frequency: "one_time",
        fundId: "emergency",
        amountCents: 7500,
        feeCoveredCents: 255,
        cardLast4: "4242",
        tribute: { type: "memory", honoreeName: "Jo Rivera", notifyEmail: "family@example.com" },
      },
      stripe: { paymentIntentId: "pi_1", sessionId: "cs_test_1" },
    });
  });

  it("skips subscription checkouts, which are recorded per invoice", async () => {
    const subscriptionCheckout = event("checkout.session.completed", {
      ...checkoutCompleted.data.object,
      mode: "subscription",
    });
    expect(await planWebhookEvent(fakeStripe, subscriptionCheckout)).toBeNull();
  });

  it("ignores payments this site didn't create", async () => {
    const foreign = event("checkout.session.completed", {
      ...checkoutCompleted.data.object,
      metadata: {},
    });
    expect(await planWebhookEvent(fakeStripe, foreign)).toBeNull();
  });

  it("plans monthly instalments and only notifies the honoree on the first", async () => {
    const invoice = (billingReason: string) =>
      event("invoice.paid", {
        id: "in_1",
        number: "ABC-0001",
        amount_paid: 2606,
        customer: "cus_2",
        customer_email: "pat@example.com",
        billing_reason: billingReason,
        parent: { subscription_details: { subscription: "sub_1", metadata } },
      });

    const first = await planWebhookEvent(fakeStripe, invoice("subscription_create"));
    const later = await planWebhookEvent(fakeStripe, invoice("subscription_cycle"));

    expect(first).toMatchObject({
      kind: "gift",
      sendTributeNotice: true,
      email: { frequency: "monthly", cardLast4: "1881", reference: "ABC-0001" },
      stripe: { subscriptionId: "sub_1", invoiceId: "in_1", paymentIntentId: "pi_invoice_1" },
    });
    expect(later).toMatchObject({ sendTributeNotice: false });
  });
});

describe("applyWebhookPlan", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createDb();
    await db.insert(schema.campaigns).values({ slug: "giving-day", goalCents: 1_000_000 });
  });

  it("records the donor, fund, campaign and gift", async () => {
    const plan = await planWebhookEvent(fakeStripe, checkoutCompleted);
    const result = await applyWebhookPlan(asTx(db), plan!);

    expect(result).not.toBeNull();
    const [donation] = await db.select().from(schema.donations);
    const [donor] = await db.select().from(schema.donors);
    const [fund] = await db.select().from(schema.funds);

    expect(donor).toMatchObject({
      email: "sam@example.com",
      stripeCustomerId: "cus_1",
      locale: "fr",
    });
    expect(fund.slug).toBe("emergency");
    expect(donation).toMatchObject({
      donorId: donor.id,
      fundId: fund.id,
      campaignId: expect.any(Number),
      amountCents: 7500,
      feeCoveredCents: 255,
      status: "succeeded",
      tributeType: "memory",
    });
  });

  it("records a gift only once, so emails aren't sent twice", async () => {
    const plan = await planWebhookEvent(fakeStripe, checkoutCompleted);
    await applyWebhookPlan(asTx(db), plan!);
    const second = await applyWebhookPlan(asTx(db), plan!);

    expect(second).toBeNull();
    expect(await db.$count(schema.donations)).toBe(1);
    expect(await db.$count(schema.donors)).toBe(1);
  });

  it("marks partial and full refunds", async () => {
    await applyWebhookPlan(asTx(db), (await planWebhookEvent(fakeStripe, checkoutCompleted))!);
    const refund = (amount: number, refunded: boolean) =>
      event("charge.refunded", { payment_intent: "pi_1", amount_refunded: amount, refunded });

    await applyWebhookPlan(asTx(db), (await planWebhookEvent(fakeStripe, refund(2000, false)))!);
    let [donation] = await db.select().from(schema.donations);
    expect(donation).toMatchObject({ refundedCents: 2000, status: "succeeded" });

    await applyWebhookPlan(asTx(db), (await planWebhookEvent(fakeStripe, refund(7755, true)))!);
    [donation] = await db
      .select()
      .from(schema.donations)
      .where(eq(schema.donations.stripePaymentIntentId, "pi_1"));
    expect(donation).toMatchObject({ refundedCents: 7755, status: "refunded" });
  });
});
