/**
 * Fills a development database with made-up donors, gifts, volunteers and messages, so the back
 * office has something to show. Every seeded row is marked so it can be removed again:
 * donor, volunteer, message and subscriber emails end in @seed.example, and Stripe ids start
 * with "seed_".
 *
 *   pnpm db:seed            add seed data (removes earlier seed data first)
 *   pnpm db:seed --clear    only remove seed data
 *   pnpm db:seed --seed 7   use a different random seed (the default always gives the same data)
 *
 * It won't run against production (NODE_ENV or VERCEL_ENV set to "production"). Funds and
 * campaigns are added only if missing, and are never removed.
 *
 * Values must match the schema in src/db/schema.ts, FUND_IDS in src/config/donation.ts and the
 * enums in src/lib/form-schemas.ts.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

import postgres from "postgres";

const FUND_IDS = ["general", "morale", "development", "community"];
const AFFILIATIONS = ["airman", "military", "family", "community"];
const INTERESTS = ["events", "projects", "mentoring", "skills", "outreach"];
const TOPICS = ["general", "airmen", "giving", "partnering", "other"];
const LOCALES = ["en", "en", "en", "en", "en", "en", "es", "es", "fr"];
const DOMAIN = "seed.example";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) fail("DATABASE_URL isn't set. Add it to .env.local first.");
if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  fail("Refusing to seed a production database.");
}

const { values } = parseArgs({
  options: {
    clear: { type: "boolean", default: false },
    seed: { type: "string", default: "1" },
  },
});

// mulberry32: small, deterministic, good enough for fake data.
let state = Number.parseInt(values.seed, 10) >>> 0 || 1;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

const FIRST = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Jamie",
  "Avery",
  "Quinn",
  "Sam",
  "Dana",
  "Chris",
  "Pat",
  "Robin",
  "Lee",
  "Maria",
  "José",
  "Lucía",
  "Camille",
  "Léa",
  "Hugo",
  "Elena",
  "Diego",
  "Noah",
  "Grace",
  "Aisha",
  "Kenji",
  "Priya",
  "Omar",
  "Hannah",
];
const LAST = [
  "Garcia",
  "Smith",
  "Johnson",
  "Nguyen",
  "Brown",
  "Martinez",
  "Davis",
  "Lopez",
  "Wilson",
  "Moreau",
  "Dubois",
  "Hernández",
  "Clark",
  "Lewis",
  "Walker",
  "Young",
  "King",
  "Wright",
  "Scott",
  "Adams",
  "Baker",
  "Rivera",
  "Bernard",
  "Okafor",
  "Patel",
];
const PRESETS = [1000, 2500, 2500, 5000, 5000, 5000, 10000, 10000, 25000, 50000];
const MONTHLY_PRESETS = [500, 1000, 1000, 2000, 2500, 5000];
const HONOREES = [
  "SrA Jamie Cole",
  "my grandfather, MSgt Ray Ortiz",
  "the 88th crew",
  "A1C Lin Park",
];
const AVAILABILITY = [
  null,
  "Weekends",
  "Weekday evenings",
  "Once a month",
  "Flexible after duty hours",
];
const MESSAGES = {
  general: "Hi, I'd like to know more about how the group is organised and who runs it.",
  airmen: "I'm new on base and heard about the meetings. Are they open to everyone E-1 to E-4?",
  giving: "Can I set up a gift through my company's matching programme? What do you need from me?",
  partnering: "Our business near the base would like to sponsor a morale event this spring.",
  other: "Just wanted to say thanks for the barbecue last month. It meant a lot to our shop.",
};

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (days) => new Date(now - days * DAY - between(0, DAY - 1));
/** What a donor adds to cover card fees (2.9% + 30¢), grossed up. */
const feeFor = (cents) => Math.round((cents + 30) / (1 - 0.029)) - cents;

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const host = new URL(process.env.DATABASE_URL).host;

const clear = async (tx) => {
  const like = `%@${DOMAIN}`;
  await tx`delete from subscription_cancellations where stripe_subscription_id like 'seed_%'`;
  await tx`delete from donations where donor_id in (select id from donors where email like ${like})`;
  await tx`delete from donors where email like ${like}`;
  await tx`delete from volunteers where email like ${like}`;
  await tx`delete from contact_messages where email like ${like}`;
  await tx`delete from newsletter_subscribers where email like ${like}`;
};

const seed = async (tx) => {
  for (const [i, slug] of FUND_IDS.entries()) {
    await tx`insert into funds (slug, sort_order) values (${slug}, ${i}) on conflict (slug) do nothing`;
  }
  await tx`
    insert into campaigns (slug, goal_cents, starts_at, ends_at)
    values
      ('spring-morale', 500000, ${daysAgo(30)}, ${new Date(now + 30 * DAY)}),
      ('holiday-2025', 300000, ${daysAgo(380)}, ${daysAgo(320)})
    on conflict (slug) do nothing`;

  const fundIds = Object.fromEntries(
    (await tx`select id, slug from funds`).map((row) => [row.slug, row.id]),
  );
  const campaignIds = Object.fromEntries(
    (await tx`select id, slug from campaigns`).map((row) => [row.slug, row.id]),
  );

  const donorRows = [];
  const used = new Set();
  while (donorRows.length < 120) {
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const email = `${firstName}.${lastName}${between(1, 99)}@${DOMAIN}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    if (used.has(email)) continue;
    used.add(email);
    donorRows.push({
      email,
      first_name: firstName,
      last_name: lastName,
      stripe_customer_id: `seed_cus_${donorRows.length + 1}`,
      locale: pick(LOCALES),
      marketing_opt_in: chance(0.4),
      created_at: daysAgo(between(0, 420)),
    });
  }
  const donors = await tx`insert into donors ${tx(donorRows)} returning id, locale, created_at`;

  const donationRows = [];
  let n = 0;
  const base = (donor, createdAt) => {
    n += 1;
    const inSpring = createdAt.getTime() > now - 30 * DAY && chance(0.5);
    const inHoliday =
      createdAt.getTime() > now - 380 * DAY && createdAt.getTime() < now - 320 * DAY && chance(0.6);
    return {
      donor_id: donor.id,
      campaign_id: inSpring
        ? campaignIds["spring-morale"]
        : inHoliday
          ? campaignIds["holiday-2025"]
          : null,
      fund_id: fundIds[pick(FUND_IDS)],
      locale: donor.locale,
      created_at: createdAt,
      stripe_session_id: `seed_cs_${n}`,
      stripe_payment_intent_id: `seed_pi_${n}`,
      tribute_type: null,
      honoree_name: null,
      stripe_subscription_id: null,
      stripe_invoice_id: null,
    };
  };

  const cancellations = [];
  for (const donor of donors) {
    const joined = Math.floor((now - donor.created_at.getTime()) / DAY);

    if (chance(0.22)) {
      // Monthly: one row per paid invoice from the day they joined, some cancelled since.
      const subscription = `seed_sub_${donor.id}`;
      const amount = pick(MONTHLY_PRESETS);
      const covers = chance(0.6);
      const fund = fundIds[pick(FUND_IDS)];
      const months = Math.floor(joined / 30) + 1;
      const cancelAfter = chance(0.25) ? between(1, months) : months;
      for (let m = 0; m < cancelAfter; m += 1) {
        const row = base(donor, daysAgo(joined - m * 30));
        donationRows.push({
          ...row,
          fund_id: fund,
          campaign_id: null,
          amount_cents: amount,
          fee_covered_cents: covers ? feeFor(amount) : 0,
          refunded_cents: 0,
          frequency: "monthly",
          status: chance(0.03) ? "failed" : "succeeded",
          stripe_session_id: m === 0 ? row.stripe_session_id : null,
          stripe_subscription_id: subscription,
          stripe_invoice_id: `seed_in_${n}`,
        });
      }
      if (cancelAfter < months) {
        cancellations.push({
          stripe_subscription_id: subscription,
          cancelled_at: daysAgo(joined - cancelAfter * 30 + 5),
        });
      }
      continue;
    }

    // One-time: one to three gifts.
    for (let g = 0, gifts = chance(0.25) ? between(2, 3) : 1; g < gifts; g += 1) {
      const row = base(donor, daysAgo(between(0, joined)));
      const amount = chance(0.15) ? between(5, 400) * 100 + pick([0, 0, 50]) : pick(PRESETS);
      const status = chance(0.04) ? "failed" : chance(0.05) ? "refunded" : "succeeded";
      const tribute = chance(0.1) ? pick(["honour", "memory"]) : null;
      donationRows.push({
        ...row,
        amount_cents: amount,
        fee_covered_cents: chance(0.55) ? feeFor(amount) : 0,
        refunded_cents: status === "refunded" ? (chance(0.7) ? amount : Math.floor(amount / 2)) : 0,
        frequency: "one_time",
        status,
        tribute_type: tribute,
        honoree_name: tribute ? pick(HONOREES) : null,
      });
    }
  }

  for (let i = 0; i < donationRows.length; i += 500) {
    await tx`insert into donations ${tx(donationRows.slice(i, i + 500))}`;
  }
  if (cancellations.length) await tx`insert into subscription_cancellations ${tx(cancellations)}`;

  const volunteerRows = Array.from({ length: 32 }, (_, i) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    return {
      name,
      email: `volunteer${i + 1}@${DOMAIN}`,
      phone: chance(0.6) ? `+1 937 555 0${String(between(100, 199))}` : null,
      affiliation: pick(AFFILIATIONS),
      interests: INTERESTS.filter(() => chance(0.4))
        .concat(pick(INTERESTS))
        .filter((value, index, list) => list.indexOf(value) === index),
      availability: pick(AVAILABILITY),
      locale: pick(LOCALES),
      created_at: daysAgo(between(0, 200)),
    };
  });
  await tx`insert into volunteers ${tx(volunteerRows)}`;

  const messageRows = Array.from({ length: 24 }, (_, i) => {
    const topic = pick(TOPICS);
    return {
      name: `${pick(FIRST)} ${pick(LAST)}`,
      email: `message${i + 1}@${DOMAIN}`,
      topic,
      message: MESSAGES[topic],
      locale: pick(LOCALES),
      created_at: daysAgo(between(0, 120)),
    };
  });
  await tx`insert into contact_messages ${tx(messageRows)}`;

  const subscriberRows = Array.from({ length: 40 }, (_, i) => {
    const createdAt = daysAgo(between(0, 300));
    const status = chance(0.7) ? "subscribed" : chance(0.5) ? "pending" : "unsubscribed";
    const confirmedAt =
      status === "pending" ? null : new Date(createdAt.getTime() + between(60_000, DAY));
    return {
      email: `subscriber${i + 1}@${DOMAIN}`,
      status,
      locale: pick(LOCALES),
      confirmation_sent_at: createdAt,
      confirmed_at: confirmedAt,
      unsubscribed_at:
        status === "unsubscribed" ? new Date(confirmedAt.getTime() + between(1, 60) * DAY) : null,
      created_at: createdAt,
    };
  });
  await tx`insert into newsletter_subscribers ${tx(subscriberRows)}`;

  return {
    donors: donors.length,
    donations: donationRows.length,
    cancelled: cancellations.length,
    volunteers: volunteerRows.length,
    messages: messageRows.length,
    subscribers: subscriberRows.length,
  };
};

try {
  const result = await sql.begin(async (tx) => {
    await clear(tx);
    return values.clear ? null : seed(tx);
  });
  if (result) {
    console.log(`Seeded ${host}:`);
    console.table(result);
  } else {
    console.log(`Removed seed data from ${host}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
