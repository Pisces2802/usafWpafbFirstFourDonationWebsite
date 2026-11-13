import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";

import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { adminTranslator as t } from "@/lib/admin/translator";
import { sendAdminEmail } from "@/lib/emails";
import { getClientIp } from "@/lib/rate-limit";

export type SecurityEvent =
  | "signedIn"
  | "recoveryCodeUsed"
  | "passwordChanged"
  | "passwordReset"
  | "twoFactorEnabled"
  | "recoveryCodesRegenerated"
  | "twoFactorReset";

type Recipient = { email: string; notifySecurity: boolean; timeZone: string | null };

type NoticeOptions = {
  /** Values for the event's body message, like the name of the owner who made the change. */
  values?: Record<string, string>;
  /**
   * Send even if they've turned security emails off. For changes someone else made to their
   * account, which they'd otherwise have no way to hear about.
   */
  always?: boolean;
};

/**
 * Tells someone about a sign-in or security change on their account, if they haven't turned these
 * emails off. Sent after the response, so a slow email service doesn't hold up the action.
 */
export const sendSecurityNotice = async (
  to: Recipient,
  event: SecurityEvent,
  { values, always = false }: NoticeOptions = {},
) => {
  if (!to.notifySecurity && !always) return;

  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders) ?? t("auth.emails.security.unknownIp");
  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: to.timeZone ?? siteConfig.timeZone,
    timeZoneName: "short",
  }).format(new Date());

  after(() =>
    sendAdminEmail({
      to: to.email,
      subject: t(`auth.emails.security.${event}.subject`, { orgName: siteConfig.orgName }),
      heading: t(`auth.emails.security.${event}.heading`),
      paragraphs: [
        t(`auth.emails.security.${event}.body`, values),
        t("auth.emails.security.details", { when, ip }),
        t(always ? "auth.emails.security.notExpected" : "auth.emails.security.notYou"),
      ],
      link: {
        label: t("auth.emails.security.button"),
        href: `${env.NEXT_PUBLIC_SITE_URL}/admin/settings?tab=security`,
      },
      footer: [t(always ? "auth.emails.security.footerAlways" : "auth.emails.security.footer")],
    }),
  );
};
