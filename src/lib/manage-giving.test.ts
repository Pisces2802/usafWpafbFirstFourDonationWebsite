import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import {
  createManageToken,
  type ManageGivingDeps,
  processManageGivingRequest,
  readManageToken,
} from "@/lib/manage-giving";

const SECRET = "test-secret-that-is-at-least-32-characters";
const NOW = new Date("2026-11-13T12:00:00Z");
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe("manage-giving tokens", () => {
  it("round-trips a subscription until the link expires", () => {
    const token = createManageToken("sub_123", SECRET, NOW);

    expect(readManageToken(token, SECRET, minutesLater(29))).toBe("sub_123");
    expect(readManageToken(token, SECRET, minutesLater(31))).toBeNull();
  });

  it("rejects tokens that were changed or signed with another secret", () => {
    const token = createManageToken("sub_123", SECRET, NOW);
    const [, expiresAt, signature] = token.split(".");

    expect(readManageToken(`sub_999.${expiresAt}.${signature}`, SECRET, NOW)).toBeNull();
    expect(
      readManageToken(`sub_123.${Number(expiresAt) + 60_000}.${signature}`, SECRET, NOW),
    ).toBeNull();
    expect(readManageToken(token, `${SECRET}-other`, NOW)).toBeNull();
    expect(readManageToken("", SECRET, NOW)).toBeNull();
    expect(readManageToken("not-a-token", SECRET, NOW)).toBeNull();
  });
});

describe("processManageGivingRequest", () => {
  let db: Db;
  let sendLink: ReturnType<typeof vi.fn<ManageGivingDeps["sendLink"]>>;

  const deps = (overrides: Partial<ManageGivingDeps> = {}): ManageGivingDeps => ({
    db,
    secret: SECRET,
    canSend: true,
    siteUrl: "https://example.org",
    isRateLimited: () => false,
    verify: async () => "ok",
    sendLink,
    ...overrides,
  });

  const request = (email: string) => ({ form: { email }, locale: "es", turnstileToken: "token" });

  const addGift = async (
    email: string,
    gift: { frequency: "one_time" | "monthly"; subscriptionId: string | null; invoiceId: string },
  ) => {
    const [donor] = await db
      .insert(schema.donors)
      .values({ email, firstName: "Pat", lastName: "Lee", locale: "en" })
      .onConflictDoUpdate({ target: schema.donors.email, set: { firstName: "Pat" } })
      .returning({ id: schema.donors.id });
    await db.insert(schema.funds).values({ slug: "general" }).onConflictDoNothing();
    const [fund] = await db.select({ id: schema.funds.id }).from(schema.funds);
    await db.insert(schema.donations).values({
      donorId: donor.id,
      fundId: fund.id,
      amountCents: 2500,
      frequency: gift.frequency,
      status: "succeeded",
      stripeSubscriptionId: gift.subscriptionId,
      stripeInvoiceId: gift.invoiceId,
      locale: "en",
    });
  };

  beforeEach(async () => {
    const pglite = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(pglite, { migrationsFolder: "drizzle" });
    db = pglite as unknown as Db;
    sendLink = vi.fn<ManageGivingDeps["sendLink"]>(async () => {});
  });

  it("emails a signed link for the donor's monthly gift", async () => {
    await addGift("pat@example.com", {
      frequency: "monthly",
      subscriptionId: "sub_1",
      invoiceId: "in_1",
    });

    const result = await processManageGivingRequest(request(" Pat@Example.com "), deps());

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(sendLink).toHaveBeenCalledTimes(1);
    const sent = sendLink.mock.calls[0][0];
    expect(sent).toMatchObject({ locale: "es", donorEmail: "pat@example.com", firstName: "Pat" });

    const url = new URL(sent.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://example.org/api/manage-giving");
    expect(url.searchParams.get("locale")).toBe("es");
    expect(readManageToken(url.searchParams.get("token") ?? "", SECRET)).toBe("sub_1");
  });

  it("answers the same way, without an email, when there's nothing to manage", async () => {
    await addGift("once@example.com", {
      frequency: "one_time",
      subscriptionId: null,
      invoiceId: "in_2",
    });
    await addGift("ended@example.com", {
      frequency: "monthly",
      subscriptionId: "sub_ended",
      invoiceId: "in_3",
    });
    await db
      .insert(schema.subscriptionCancellations)
      .values({ stripeSubscriptionId: "sub_ended", cancelledAt: NOW });

    for (const email of ["nobody@example.com", "once@example.com", "ended@example.com"]) {
      expect(await processManageGivingRequest(request(email), deps())).toEqual({
        status: 200,
        body: { ok: true },
      });
    }
    expect(sendLink).not.toHaveBeenCalled();
  });

  it("still answers ok when the email can't be sent", async () => {
    await addGift("pat@example.com", {
      frequency: "monthly",
      subscriptionId: "sub_1",
      invoiceId: "in_1",
    });
    sendLink.mockRejectedValueOnce(new Error("Resend is down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await processManageGivingRequest(request("pat@example.com"), deps());

    expect(result.status).toBe(200);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("refuses rate-limited, invalid, unverified and unconfigured requests", async () => {
    const limited = await processManageGivingRequest(
      request("pat@example.com"),
      deps({ isRateLimited: () => true }),
    );
    const invalid = await processManageGivingRequest(request("not-an-email"), deps());
    const unverified = await processManageGivingRequest(
      request("pat@example.com"),
      deps({ verify: async () => "failed" }),
    );
    const noSecret = await processManageGivingRequest(
      request("pat@example.com"),
      deps({ secret: undefined }),
    );
    const noEmail = await processManageGivingRequest(
      request("pat@example.com"),
      deps({ canSend: false }),
    );

    expect(limited).toEqual({ status: 429, body: { error: "rate_limited" } });
    expect(invalid).toEqual({ status: 400, body: { error: "invalid" } });
    expect(unverified).toEqual({ status: 403, body: { error: "verification_failed" } });
    expect(noSecret).toEqual({ status: 503, body: { error: "unavailable" } });
    expect(noEmail).toEqual({ status: 503, body: { error: "unavailable" } });
    expect(sendLink).not.toHaveBeenCalled();
  });
});
