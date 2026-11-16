import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { CONTACT_TOPICS, NEWSLETTER_STATUSES, VOLUNTEER_AFFILIATIONS } from "@/lib/form-schemas";
import { STORY_STATUSES, type StoryContent } from "@/lib/stories/story-schema";

export const frequency = pgEnum("frequency", ["one_time", "monthly"]);
export const donationStatus = pgEnum("donation_status", ["succeeded", "refunded", "failed"]);
export const tributeType = pgEnum("tribute_type", ["honour", "memory"]);
export const volunteerAffiliation = pgEnum("volunteer_affiliation", VOLUNTEER_AFFILIATIONS);
export const contactTopic = pgEnum("contact_topic", CONTACT_TOPICS);
/** How someone confirms it's them after their password. No row value means they don't use one. */
export const adminTwoFactorMethod = pgEnum("admin_two_factor_method", ["authenticator", "email"]);
export const adminSessionStage = pgEnum("admin_session_stage", ["two_factor", "active"]);
export const storyStatus = pgEnum("story_status", STORY_STATUSES);
export const adminTokenPurpose = pgEnum("admin_token_purpose", ["verify_email", "reset_password"]);
export const newsletterStatus = pgEnum("newsletter_status", NEWSLETTER_STATUSES);
/** Where a new campaign is in its two-person sign-off. Only approved ones reach the public site. */
export const campaignApproval = pgEnum("campaign_approval", ["pending", "approved", "rejected"]);

/** Names and descriptions live in the messages files, keyed by slug. */
export const funds = pgTable("funds", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
});

/** A change to an approved campaign, waiting for someone else to approve it. Dates are ISO strings. */
export type CampaignChange = {
  slug: string;
  goalCents: number;
  startsAt: string | null;
  endsAt: string | null;
};

/**
 * A new campaign needs two people: whoever creates it (or changes it while it waits) asks, and
 * someone else with `campaigns:approve` approves or turns it down. Until it's approved it isn't
 * on the site and gifts don't count towards it. Changes to an approved campaign wait the same
 * way in `proposedChange` while the live campaign stays as it is. The database refuses an
 * approval by whoever asked, and any change to an approved campaign that skips this.
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    goalCents: integer().notNull(),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    approval: campaignApproval().notNull().default("pending"),
    /** Who created it. Null for campaigns from before approvals, or added outside the app. */
    createdById: integer().references((): AnyPgColumn => adminUsers.id),
    /** Who last asked for approval: the creator, or whoever last changed it while it waited. */
    requestedById: integer().references((): AnyPgColumn => adminUsers.id),
    requestedAt: timestamp({ withTimezone: true }),
    reviewedById: integer().references((): AnyPgColumn => adminUsers.id),
    reviewedAt: timestamp({ withTimezone: true }),
    /** Why it was turned down, shown to whoever asked. */
    reviewNote: text(),
    /** A change to the approved campaign that's waiting for approval, or null. */
    proposedChange: jsonb().$type<CampaignChange>(),
    changeRequestedById: integer().references((): AnyPgColumn => adminUsers.id),
    changeRequestedAt: timestamp({ withTimezone: true }),
    changeReviewedById: integer().references((): AnyPgColumn => adminUsers.id),
    changeReviewedAt: timestamp({ withTimezone: true }),
    /** Why the last change was turned down, shown to whoever asked until they ask again. */
    changeReviewNote: text(),
  },
  (table) => [
    check(
      "campaigns_approved_by_someone_else",
      // Campaigns from before approvals have no creator and count as approved by nobody.
      sql`${table.approval} <> 'approved' or (${table.createdById} is null and ${table.requestedById} is null) or (${table.reviewedById} is not null and ${table.reviewedById} is distinct from ${table.createdById} and ${table.reviewedById} is distinct from ${table.requestedById})`,
    ),
    index().on(table.approval),
  ],
);

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

/** Monthly gifts that have ended, so they stop counting as active monthly donors. */
export const subscriptionCancellations = pgTable("subscription_cancellations", {
  stripeSubscriptionId: text().primaryKey(),
  cancelledAt: timestamp({ withTimezone: true }).notNull(),
});

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
 * Request counts for rate limiting, shared by every server instance. One row per key per fixed
 * window; the key (which usually holds an IP address) is stored only as a SHA-256 hash.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    keyHash: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    hits: integer().notNull().default(1),
    /** When the window closes; rows past this are deleted from time to time. */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.windowStart] }),
    index().on(table.expiresAt),
  ],
);

/**
 * Newsletter sign-ups from the footer. An address is `pending` until its owner follows the
 * confirmation link, so only people who asked are ever `subscribed`. Unsubscribing keeps the row,
 * so the address isn't added back by mistake. Emails are stored lowercase.
 */
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: serial().primaryKey(),
    email: text().notNull().unique(),
    status: newsletterStatus().notNull().default("pending"),
    /** The language they signed up in, for the emails we send them. */
    locale: text().notNull(),
    /** When the last confirmation email went out, so repeat sign-ups can't flood an inbox. */
    confirmationSentAt: timestamp({ withTimezone: true }),
    confirmedAt: timestamp({ withTimezone: true }),
    unsubscribedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("newsletter_subscribers_email_lowercase", sql`${table.email} = lower(${table.email})`),
    index().on(table.status),
  ],
);

/**
 * Named sets of permissions. Permission names are defined in code (`src/lib/admin/permissions.ts`),
 * which also ignores any stored name it no longer knows. Built-in roles have a slug; SuperAdmin
 * (`is_super`) holds every permission, including ones added later, and can't be changed.
 */
export const adminRoles = pgTable(
  "admin_roles",
  {
    id: serial().primaryKey(),
    /** Set for the built-in roles only, so code and scripts can find them by a stable key. */
    slug: text().unique(),
    name: text().notNull(),
    description: text().notNull().default(""),
    permissions: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isSuper: boolean().notNull().default(false),
    isBuiltIn: boolean().notNull().default(false),
    createdById: integer().references((): AnyPgColumn => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("admin_roles_name_lower").on(sql`lower(${table.name})`)],
);

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
    roleId: integer()
      .notNull()
      .references((): AnyPgColumn => adminRoles.id, { onDelete: "restrict" }),
    isActive: boolean().notNull().default(true),
    /** scrypt hash; null until they follow their invite link and choose a password. */
    passwordHash: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    /** AES-GCM encrypted base32 TOTP secret; null until two-factor is set up. */
    totpSecret: text(),
    /** Last accepted TOTP time step, so a code can't be used twice. */
    totpLastStep: integer(),
    /** Null means no second step; required for anyone with an `identity:` or `auth:` permission. */
    twoFactorMethod: adminTwoFactorMethod(),
    /**
     * Set when someone with `auth:lock` locks the account, e.g. if its password may be known to
     * someone else. Sessions end and sign-in is refused until it's unlocked. Separate from
     * `lockedUntil`, which is the automatic 15-minute lock after wrong passwords.
     */
    suspendedAt: timestamp({ withTimezone: true }),
    suspendedById: integer().references((): AnyPgColumn => adminUsers.id, {
      onDelete: "set null",
    }),
    suspendReason: text(),
    failedSignInCount: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
    createdById: integer().references((): AnyPgColumn => adminUsers.id, { onDelete: "set null" }),
    lastSignInAt: timestamp({ withTimezone: true }),
    /** IANA time zone for dates in the back office; null uses the site default. */
    timeZone: text(),
    /** Rows per page in back-office tables. */
    pageSize: integer().notNull().default(10),
    /** Email this person about new volunteer sign-ups (needs `volunteers:read`). */
    notifyVolunteers: boolean().notNull().default(false),
    /** Email this person about new contact messages (needs `messages:read`). */
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
    /** HMAC of the code last emailed for this session, for email two-step verification. */
    emailCodeHash: text(),
    emailCodeExpiresAt: timestamp({ withTimezone: true }),
    emailCodeSentAt: timestamp({ withTimezone: true }),
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

/**
 * Stories about what gifts made possible, written in the back office. `content` holds each
 * language's text; English is always there, and a missing Spanish or French version falls back to
 * it. Bodies are HTML from the editor, sanitised before they're saved; their images live on
 * Cloudinary.
 */
export const stories = pgTable(
  "stories",
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    /** A fund id from `config/donation`; the story links to giving to it. */
    fundId: text().notNull(),
    status: storyStatus().notNull().default("draft"),
    /** Shown on the home page. At most one story is featured. */
    isFeatured: boolean().notNull().default(false),
    /** Written to show the layout; the site labels it as a sample. */
    isSample: boolean().notNull().default(false),
    publishedOn: date({ mode: "string" }).notNull(),
    content: jsonb().$type<StoryContent>().notNull(),
    createdById: integer().references(() => adminUsers.id, { onDelete: "set null" }),
    updatedById: integer().references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("stories_one_featured")
      .on(table.isFeatured)
      .where(sql`${table.isFeatured}`),
    index().on(table.status, table.publishedOn),
  ],
);
