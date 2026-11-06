import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const frequency = pgEnum("frequency", ["one_time", "monthly"]);
export const donationStatus = pgEnum("donation_status", ["succeeded", "refunded", "failed"]);
export const tributeType = pgEnum("tribute_type", ["honour", "memory"]);

/** Names and descriptions live in the messages files, keyed by slug. */
export const funds = pgTable("funds", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
});

export const campaigns = pgTable("campaigns", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  goalCents: integer().notNull(),
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
});

export const donors = pgTable("donors", {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  stripeCustomerId: text().unique(),
  locale: text().notNull(),
  marketingOptIn: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per successful charge: a one-time gift, or each paid monthly invoice. `amountCents` is
 * the gift itself; `feeCoveredCents` is what the donor added for card fees on top of it.
 */
export const donations = pgTable(
  "donations",
  {
    id: serial().primaryKey(),
    donorId: integer()
      .notNull()
      .references(() => donors.id),
    campaignId: integer().references(() => campaigns.id),
    fundId: integer()
      .notNull()
      .references(() => funds.id),
    amountCents: integer().notNull(),
    feeCoveredCents: integer().notNull().default(0),
    refundedCents: integer().notNull().default(0),
    currency: text().notNull().default("usd"),
    frequency: frequency().notNull(),
    status: donationStatus().notNull(),
    stripeSessionId: text(),
    stripePaymentIntentId: text().unique(),
    stripeSubscriptionId: text(),
    stripeInvoiceId: text().unique(),
    tributeType: tributeType(),
    honoreeName: text(),
    locale: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.donorId),
    index().on(table.campaignId),
    index().on(table.stripeSubscriptionId),
  ],
);

export const stripeEvents = pgTable("stripe_events", {
  id: text().primaryKey(),
  type: text().notNull(),
  processedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const volunteers = pgTable("volunteers", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
  interests: text().array().notNull().default([]),
  availability: text(),
  locale: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
