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
  | "recoveryCodesRegenerated";

type Recipient = { email: string; notifySecurity: boolean; timeZone: string | null };

/**
 * Tells someone about a sign-in or security change on their account, if they haven't turned these
 * emails off. Sent after the response, so a slow email service doesn't hold up the action.
 */
export const sendSecurityNotice = async (to: Recipient, event: SecurityEvent) => {
  if (!to.notifySecurity) return;

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
        t(`auth.emails.security.${event}.body`),
        t("auth.emails.security.details", { when, ip }),
        t("auth.emails.security.notYou"),
      ],
      link: {
        label: t("auth.emails.security.button"),
        href: `${env.NEXT_PUBLIC_SITE_URL}/admin/settings?tab=security`,
      },
      footer: [t("auth.emails.security.footer")],
    }),
  );
};
