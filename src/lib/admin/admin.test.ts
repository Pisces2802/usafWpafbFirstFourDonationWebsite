import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { toCsv } from "@/lib/admin/csv";
import { getAdminOverview, listDonations, listDonors, listVolunteers } from "@/lib/admin/queries";

const NOW = new Date("2026-11-01T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

let db: Db;

beforeEach(async () => {
  const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(testDb, { migrationsFolder: "drizzle" });
  db = testDb as unknown as Db;

  const [fund] = await db.insert(schema.funds).values({ slug: "emergency" }).returning();
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({ slug: "giving-day", goalCents: 100_000 })
    .returning();
  const [sam, ana] = await db
    .insert(schema.donors)
    .values([
      { email: "sam@example.com", firstName: "Sam", lastName: "Lee", locale: "en" },
      { email: "ana@example.com", firstName: "Ana", lastName: "Ruiz", locale: "es" },
      { email: "idle@example.com", firstName: "No", lastName: "Gifts", locale: "fr" },
    ])
    .returning();

  const base = { fundId: fund!.id, locale: "en", status: "succeeded" as const };
  await db.insert(schema.donations).values([
    {
      ...base,
      donorId: sam!.id,
      campaignId: campaign!.id,
      amountCents: 7500,
      feeCoveredCents: 255,
      frequency: "one_time",
      stripePaymentIntentId: "pi_1",
      createdAt: daysAgo(60),
    },
    {
      ...base,
      donorId: sam!.id,
      amountCents: 2500,
      frequency: "monthly",
      stripeSubscriptionId: "sub_1",
      stripeInvoiceId: "in_1",
      createdAt: daysAgo(10),
    },
    {
      ...base,
      donorId: ana!.id,
      amountCents: 5000,
      refundedCents: 2000,
      status: "refunded",
      frequency: "one_time",
      stripePaymentIntentId: "pi_2",
      createdAt: daysAgo(3),
    },
    {
      ...base,
      donorId: ana!.id,
      amountCents: 9900,
      status: "failed",
      frequency: "one_time",
      stripePaymentIntentId: "pi_3",
      createdAt: daysAgo(1),
    },
  ]);

  await db.insert(schema.volunteers).values([
    { name: "Old", email: "old@example.com", locale: "en", createdAt: daysAgo(30) },
    { name: "New", email: "new@example.com", locale: "en", interests: ["events"] },
  ]);
});

describe("getAdminOverview", () => {
  it("totals net giving, excluding fees, refunds and failed charges", async () => {
    expect(await getAdminOverview(db, { now: NOW })).toEqual({
      netCents: 7500 + 2500 + 3000,
      feesCoveredCents: 255,
      refundedCents: 2000,
      giftCount: 3,
      donorCount: 2,
      monthlyDonorCount: 1,
    });
  });

  it("limits totals to gifts since a date", async () => {
    const overview = await getAdminOverview(db, { since: daysAgo(30), now: NOW });
    expect(overview).toMatchObject({ netCents: 5500, giftCount: 2, donorCount: 2 });
  });

  it("stops counting a monthly donor after a missed billing window", async () => {
    const overview = await getAdminOverview(db, { now: daysAgo(-40) });
    expect(overview.monthlyDonorCount).toBe(0);
  });
});

describe("lists", () => {
  it("lists donations newest first with donor, fund and campaign", async () => {
    const rows = await listDonations(db);
    expect(rows.map((row) => row.stripePaymentIntentId ?? row.stripeInvoiceId)).toEqual([
      "pi_3",
      "pi_2",
      "in_1",
      "pi_1",
    ]);
    expect(rows.at(-1)).toMatchObject({
      donorEmail: "sam@example.com",
      fund: "emergency",
      campaign: "giving-day",
    });
    expect(rows[0]!.campaign).toBeNull();
  });

  it("lists donors by latest gift with lifetime net, keeping donors without gifts", async () => {
    const rows = await listDonors(db);
    expect(
      rows.map(({ email, netCents, giftCount, isMonthly }) => ({
        email,
        netCents,
        giftCount,
        isMonthly,
      })),
    ).toEqual([
      { email: "ana@example.com", netCents: 3000, giftCount: 1, isMonthly: false },
      { email: "sam@example.com", netCents: 10_000, giftCount: 2, isMonthly: true },
      { email: "idle@example.com", netCents: 0, giftCount: 0, isMonthly: false },
    ]);
  });

  it("lists volunteers newest first", async () => {
    expect((await listVolunteers(db)).map((row) => row.name)).toEqual(["New", "Old"]);
  });
});

describe("toCsv", () => {
  it("quotes, escapes and defuses spreadsheet formulas", () => {
    const csv = toCsv(
      [
        { name: 'Jo "JJ", Rivera', note: "=HYPERLINK(1)", amount: -5, at: new Date(0) },
        { name: "Line\nbreak", note: null, amount: 10, at: null },
      ],
      [
        { header: "Name", value: (row) => row.name },
        { header: "Note", value: (row) => row.note },
        { header: "Amount", value: (row) => row.amount },
        { header: "At", value: (row) => row.at },
      ],
    );
    expect(csv).toBe(
      "Name,Note,Amount,At\r\n" +
        '"Jo ""JJ"", Rivera",\'=HYPERLINK(1),-5,1970-01-01T00:00:00.000Z\r\n' +
        '"Line\nbreak",,10,\r\n',
    );
  });
});
