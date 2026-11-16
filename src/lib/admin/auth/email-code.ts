import "server-only";

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { siteConfig } from "@/config/site";
import type { Db } from "@/db";
import type { adminSessions } from "@/db/schema";
import { env } from "@/env";
import { setEmailCode } from "@/lib/admin/auth/queries";
import { adminTranslator as t } from "@/lib/admin/translator";
import { isEmailConfigured, sendAdminEmail } from "@/lib/emails";
import { isRateLimited } from "@/lib/rate-limit";

/** An emailed code works for 10 minutes, the same as the step between password and code. */
export const EMAIL_CODE_TTL_MS = 10 * 60_000;
/** How long to wait before asking for another code. */
export const EMAIL_CODE_RESEND_MS = 60_000;
const EMAIL_CODES_PER_15_MINUTES = 5;

type Session = Pick<
  typeof adminSessions.$inferSelect,
  "id" | "emailCodeHash" | "emailCodeExpiresAt" | "emailCodeSentAt"
>;

/**
 * Whether emailed codes can be offered. Locally, without Resend, the code is printed in the
 * server console instead, so the flow can still be tried.
 */
export const emailCodesAvailable = () =>
  isEmailConfigured() || process.env.NODE_ENV === "development";

const key = () => {
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET isn't set");
  return createHash("sha256").update(`admin-email-code:${env.AUTH_SECRET}`).digest();
};

/** Tied to the session, so a code only works where it was asked for. */
export const hashEmailCode = (sessionId: number, code: string) =>
  createHmac("sha256", key()).update(`${sessionId}:${code}`).digest("hex");

export type EmailCodeResult = "sent" | "cooldown" | "rateLimited" | "unavailable";

/**
 * Emails a new 6-digit code for this session; any earlier one stops working. Limited to one a
 * minute, and five every 15 minutes per person, so the button can't be used to flood an inbox.
 */
export const sendEmailCode = async (
  db: Db,
  session: Session,
  user: { id: number; email: string },
  now = new Date(),
): Promise<EmailCodeResult> => {
  if (!emailCodesAvailable()) return "unavailable";
  const sentAt = session.emailCodeSentAt?.getTime();
  if (sentAt && now.getTime() - sentAt < EMAIL_CODE_RESEND_MS) return "cooldown";
  if (
    await isRateLimited(`admin-email-code:${user.id}`, {
      limit: EMAIL_CODES_PER_15_MINUTES,
      windowMs: 15 * 60_000,
    })
  ) {
    return "rateLimited";
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await setEmailCode(db, session.id, {
    codeHash: hashEmailCode(session.id, code),
    expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS),
    sentAt: now,
  });
  const emailed = await sendAdminEmail({
    to: user.email,
    subject: t("auth.emails.code.subject", { code, orgName: siteConfig.orgName }),
    heading: t("auth.emails.code.heading"),
    paragraphs: [t("auth.emails.code.body", { code }), t("auth.emails.code.expiry")],
    footer: [t("auth.emails.code.footer")],
  });
  return emailed || !isEmailConfigured() ? "sent" : "unavailable";
};

/** Whether `code` is the unexpired code last emailed for this session. */
export const matchesEmailCode = (session: Session, code: string, now = new Date()) => {
  if (!session.emailCodeHash || !session.emailCodeExpiresAt) return false;
  if (session.emailCodeExpiresAt <= now) return false;
  const expected = Buffer.from(session.emailCodeHash, "hex");
  const given = Buffer.from(hashEmailCode(session.id, code), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
};
