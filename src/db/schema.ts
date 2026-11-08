import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { ADMIN_ROLES } from "@/lib/admin/permissions";
import { CONTACT_TOPICS, VOLUNTEER_AFFILIATIONS } from "@/lib/form-schemas";

export const frequency = pgEnum("frequency", ["one_time", "monthly"]);
export const donationStatus = pgEnum("donation_status", ["succeeded", "refunded", "failed"]);
export const tributeType = pgEnum("tribute_type", ["honour", "memory"]);
export const volunteerAffiliation = pgEnum("volunteer_affiliation", VOLUNTEER_AFFILIATIONS);
export const contactTopic = pgEnum("contact_topic", CONTACT_TOPICS);
export const adminRole = pgEnum("admin_role", ADMIN_ROLES);
export const adminSessionStage = pgEnum("admin_session_stage", ["two_factor", "active"]);
export const adminTokenPurpose = pgEnum("admin_token_purpose", ["verify_email", "reset_password"]);

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
  affiliation: volunteerAffiliation(),
  interests: text().array().notNull().default([]),
  availability: text(),
  locale: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  topic: contactTopic().notNull(),
  message: text().notNull(),
  locale: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * People who can open the back office. Emails are stored lowercase, so sign-in can match on them.
 * Deactivating keeps the row for the record of who added whom; there's no hard delete.
 */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial().primaryKey(),
    email: text().notNull().unique(),
    name: text().notNull(),
    role: adminRole().notNull(),
    isActive: boolean().notNull().default(true),
    /** scrypt hash; null until they follow their invite link and choose a password. */
    passwordHash: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    /** AES-GCM encrypted base32 TOTP secret; null until two-factor is set up. */
    totpSecret: text(),
    /** Last accepted TOTP time step, so a code can't be used twice. */
    totpLastStep: integer(),
    failedSignInCount: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
    createdById: integer().references((): AnyPgColumn => adminUsers.id, { onDelete: "set null" }),
    lastSignInAt: timestamp({ withTimezone: true }),
    /** IANA time zone for dates in the back office; null uses the site default. */
    timeZone: text(),
    /** Rows per page in back-office tables. */
    pageSize: integer().notNull().default(10),
    /** Email this person about new volunteer sign-ups (needs `volunteers:view`). */
    notifyVolunteers: boolean().notNull().default(false),
    /** Email this person about new contact messages (needs `messages:view`). */
    notifyMessages: boolean().notNull().default(false),
    /** Email this person about sign-ins and security changes on their own account. */
    notifySecurity: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("admin_users_email_lowercase", sql`${table.email} = lower(${table.email})`),
    check("admin_users_page_size", sql`${table.pageSize} in (10, 20, 50, 100)`),
  ],
);

/**
 * Back-office sessions. The cookie holds a random token; only its SHA-256 is stored. A session
 * starts at `two_factor` after the password check and becomes `active` once a code is accepted,
 * with a fresh token.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial().primaryKey(),
    tokenHash: text().notNull().unique(),
    adminUserId: integer()
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    stage: adminSessionStage().notNull(),
    /** Encrypted secret shown during two-factor setup, saved to the user once confirmed. */
    pendingTotpSecret: text(),
    failedAttempts: integer().notNull().default(0),
    ip: text(),
    userAgent: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.adminUserId)],
);

/** Single-use links for verifying an email (the invite) and resetting a password. Hashed. */
export const adminTokens = pgTable(
  "admin_tokens",
  {
    id: serial().primaryKey(),
    adminUserId: integer()
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    purpose: adminTokenPurpose().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.adminUserId)],
);

/** Two-factor recovery codes, hashed, each usable once. */
export const adminRecoveryCodes = pgTable(
  "admin_recovery_codes",
  {
    id: serial().primaryKey(),
    adminUserId: integer()
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    codeHash: text().notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.adminUserId)],
);

/** Settings for the whole site, changed by owners. There's only ever one row, with id 1. */
export const platformSettings = pgTable(
  "platform_settings",
  {
    id: integer().primaryKey().default(1),
    /** Where volunteer and contact notices go; null falls back to `ORG_NOTIFY_EMAIL`. */
    inboxEmail: text(),
    /** Stops new online gifts; checkout reports that giving is unavailable. */
    donationsPaused: boolean().notNull().default(false),
    /** How long a back-office sign-in lasts. */
    sessionHours: integer().notNull().default(12),
    updatedById: integer().references(() => adminUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("platform_settings_single_row", sql`${table.id} = 1`),
    check("platform_settings_session_hours", sql`${table.sessionHours} between 1 and 24`),
  ],
);

/**
 * Who did what in the back office. The actor's name and email are copied in, so entries stay
 * readable after someone is removed. The app only ever adds entries.
 */
export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: serial().primaryKey(),
    actorId: integer().references(() => adminUsers.id, { onDelete: "set null" }),
    actorName: text(),
    actorEmail: text(),
    action: text().notNull(),
    /** What the action was done to, as shown in the log, like a person's name and email. */
    targetLabel: text(),
    details: jsonb().$type<Record<string, string | number | boolean | null>>(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.createdAt), index().on(table.actorId)],
);
