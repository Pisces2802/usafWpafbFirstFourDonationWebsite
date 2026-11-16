import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import {
  CONFIRMATION_COOLDOWN_MS,
  confirmSubscription,
  createConfirmToken,
  createUnsubscribeToken,
  type NewsletterSignupDeps,
  processNewsletterSignup,
  readConfirmToken,
  readUnsubscribeToken,
  unsubscribe,
} from "@/lib/newsletter";

const SECRET = "test-secret-that-is-at-least-32-characters";
const NOW = new Date("2026-11-15T12:00:00Z");
const daysLater = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

describe("newsletter tokens", () => {
  it("round-trips a confirm token for a week", () => {
    const token = createConfirmToken("pat@example.com", SECRET, NOW);

    expect(readConfirmToken(token, SECRET, daysLater(6.9))).toBe("pat@example.com");
    expect(readConfirmToken(token, SECRET, daysLater(7.1))).toBeNull();
  });

  it("keeps unsubscribe tokens working indefinitely", () => {
    const token = createUnsubscribeToken("pat@example.com", SECRET);
    expect(readUnsubscribeToken(token, SECRET, daysLater(3650))).toBe("pat@example.com");
  });

  it("won't accept one kind of token as the other, or a changed one", () => {
    const confirm = createConfirmToken("pat@example.com", SECRET, NOW);
    const leave = createUnsubscribeToken("pat@example.com", SECRET);
    const [, expiresAt, signature] = confirm.split(".");
    const other = Buffer.from("sam@example.com").toString("base64url");

    expect(readUnsubscribeToken(confirm, SECRET, NOW)).toBeNull();
    expect(readConfirmToken(leave, SECRET, NOW)).toBeNull();
    expect(readConfirmToken(`${other}.${expiresAt}.${signature}`, SECRET, NOW)).toBeNull();
    expect(readConfirmToken(confirm, `${SECRET}-other`, NOW)).toBeNull();
    expect(readConfirmToken("", SECRET, NOW)).toBeNull();
    expect(readConfirmToken("a.b", SECRET, NOW)).toBeNull();
  });
});

describe("newsletter sign-up, confirm and unsubscribe", () => {
  let db: Db;
  let sendConfirmation: ReturnType<typeof vi.fn<NewsletterSignupDeps["sendConfirmation"]>>;
  let now: Date;

  const deps = (overrides: Partial<NewsletterSignupDeps> = {}): NewsletterSignupDeps => ({
    db,
    secret: SECRET,
    canSend: true,
    pageUrl: (locale) => `https://example.org/${locale}/newsletter`,
    isRateLimited: () => false,
    verify: async () => "ok",
    sendConfirmation,
    now: () => now,
    ...overrides,
  });

  const request = (email: string, locale = "fr") => ({
    form: { email },
    locale,
    turnstileToken: "token",
  });

  const row = async (email: string) =>
    (
      await db
        .select()
        .from(schema.newsletterSubscribers)
        .where(eq(schema.newsletterSubscribers.email, email))
    )[0];

  const sentToken = (call = 0) =>
    new URL(sendConfirmation.mock.calls[call][0].url).searchParams.get("confirm") ?? "";

  beforeEach(async () => {
    const pglite = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(pglite, { migrationsFolder: "drizzle" });
    db = pglite as unknown as Db;
    sendConfirmation = vi.fn<NewsletterSignupDeps["sendConfirmation"]>(async () => {});
    now = NOW;
  });

  it("records a pending address and emails a confirmation link in their language", async () => {
    const result = await processNewsletterSignup(request(" Pat@Example.com "), deps());

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(await row("pat@example.com")).toMatchObject({
      status: "pending",
      locale: "fr",
      confirmationSentAt: NOW,
      confirmedAt: null,
    });

    const sent = sendConfirmation.mock.calls[0][0];
    expect(sent).toMatchObject({ locale: "fr", email: "pat@example.com" });
    expect(sent.url.startsWith("https://example.org/fr/newsletter?confirm=")).toBe(true);
    expect(readConfirmToken(sentToken(), SECRET, NOW)).toBe("pat@example.com");
  });

  it("subscribes on confirm, and a second click changes nothing", async () => {
    await processNewsletterSignup(request("pat@example.com"), deps());

    expect(await confirmSubscription(db, sentToken(), SECRET, NOW)).toBe("confirmed");
    expect(await row("pat@example.com")).toMatchObject({ status: "subscribed", confirmedAt: NOW });

    expect(await confirmSubscription(db, sentToken(), SECRET, daysLater(1))).toBe("confirmed");
    expect((await row("pat@example.com")).confirmedAt).toEqual(NOW);
  });

  it("rejects a confirm link that's expired or for an address that isn't there", async () => {
    await processNewsletterSignup(request("pat@example.com"), deps());

    expect(await confirmSubscription(db, sentToken(), SECRET, daysLater(8))).toBe("invalid");
    expect((await row("pat@example.com")).status).toBe("pending");

    const stranger = createConfirmToken("nobody@example.com", SECRET, NOW);
    expect(await confirmSubscription(db, stranger, SECRET, NOW)).toBe("invalid");
  });

  it("answers the same, without another email, for subscribers and quick repeats", async () => {
    await processNewsletterSignup(request("pat@example.com"), deps());
    now = new Date(NOW.getTime() + CONFIRMATION_COOLDOWN_MS - 1);
    expect(await processNewsletterSignup(request("pat@example.com"), deps())).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(sendConfirmation).toHaveBeenCalledTimes(1);

    await confirmSubscription(db, sentToken(), SECRET, NOW);
    now = daysLater(1);
    expect(await processNewsletterSignup(request("pat@example.com"), deps())).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
  });

  it("sends a fresh link once the cooldown has passed", async () => {
    await processNewsletterSignup(request("pat@example.com"), deps());
    now = new Date(NOW.getTime() + CONFIRMATION_COOLDOWN_MS + 1);
    await processNewsletterSignup(request("pat@example.com", "es"), deps());

    expect(sendConfirmation).toHaveBeenCalledTimes(2);
    expect((await row("pat@example.com")).locale).toBe("es");
  });

  it("unsubscribes, keeps them off the list until they confirm again", async () => {
    await processNewsletterSignup(request("pat@example.com"), deps());
    await confirmSubscription(db, sentToken(), SECRET, NOW);

    const leave = createUnsubscribeToken("pat@example.com", SECRET);
    expect(await unsubscribe(db, leave, SECRET, daysLater(30))).toBe("unsubscribed");
    expect(await row("pat@example.com")).toMatchObject({
      status: "unsubscribed",
      unsubscribedAt: daysLater(30),
    });

    now = daysLater(40);
    await processNewsletterSignup(request("pat@example.com"), deps());
    expect((await row("pat@example.com")).status).toBe("unsubscribed");

    expect(await confirmSubscription(db, sentToken(1), SECRET, daysLater(41))).toBe("confirmed");
    expect(await row("pat@example.com")).toMatchObject({
      status: "subscribed",
      unsubscribedAt: null,
    });
  });

  it("treats a valid unsubscribe link for an unknown address as done", async () => {
    const leave = createUnsubscribeToken("nobody@example.com", SECRET);
    expect(await unsubscribe(db, leave, SECRET, NOW)).toBe("unsubscribed");
    expect(await unsubscribe(db, "nope", SECRET, NOW)).toBe("invalid");
  });

  it("doesn't mark the email as sent when sending fails, so they can try again", async () => {
    sendConfirmation.mockRejectedValueOnce(new Error("Resend is down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await processNewsletterSignup(request("pat@example.com"), deps())).toEqual({
      status: 502,
      body: { error: "failed" },
    });
    expect((await row("pat@example.com")).confirmationSentAt).toBeNull();

    await processNewsletterSignup(request("pat@example.com"), deps());
    expect(sendConfirmation).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });

  it("refuses before doing anything when it can't work", async () => {
    expect(
      await processNewsletterSignup(
        request("pat@example.com"),
        deps({ isRateLimited: () => true }),
      ),
    ).toEqual({ status: 429, body: { error: "rate_limited" } });
    expect(await processNewsletterSignup(request("not-an-email"), deps())).toEqual({
      status: 400,
      body: { error: "invalid" },
    });
    expect(
      await processNewsletterSignup(request("pat@example.com"), deps({ canSend: false })),
    ).toEqual({ status: 503, body: { error: "unavailable" } });
    expect(
      await processNewsletterSignup(request("pat@example.com"), deps({ secret: undefined })),
    ).toEqual({ status: 503, body: { error: "unavailable" } });
    expect(
      await processNewsletterSignup(
        request("pat@example.com"),
        deps({ verify: async () => "failed" }),
      ),
    ).toEqual({ status: 403, body: { error: "verification_failed" } });

    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(await row("pat@example.com")).toBeUndefined();
  });
});
