import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { AUTH_SECRET: "test-secret-that-is-long-enough-1234567890" } }));
// Sending isn't tested here, so the email and translation modules (which need Next) stay out.
vi.mock("@/lib/emails", () => ({ isEmailConfigured: () => false, sendAdminEmail: vi.fn() }));
vi.mock("@/lib/admin/translator", () => ({ adminTranslator: (key: string) => key }));

const { EMAIL_CODE_TTL_MS, hashEmailCode, matchesEmailCode } =
  await import("@/lib/admin/auth/email-code");

describe("emailed codes", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const session = (id: number, code: string) => ({
    id,
    emailCodeHash: hashEmailCode(id, code),
    emailCodeExpiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS),
    emailCodeSentAt: now,
  });

  it("accepts the last code sent for this session, until it expires", () => {
    expect(matchesEmailCode(session(7, "042917"), "042917", now)).toBe(true);
    expect(matchesEmailCode(session(7, "042917"), "042918", now)).toBe(false);
    const later = new Date(now.getTime() + EMAIL_CODE_TTL_MS);
    expect(matchesEmailCode(session(7, "042917"), "042917", later)).toBe(false);
  });

  it("won't accept a code sent to another session", () => {
    expect(matchesEmailCode({ ...session(8, "042917"), id: 7 }, "042917", now)).toBe(false);
  });

  it("refuses when no code was sent", () => {
    const none = { id: 7, emailCodeHash: null, emailCodeExpiresAt: null, emailCodeSentAt: null };
    expect(matchesEmailCode(none, "000000", now)).toBe(false);
  });
});
