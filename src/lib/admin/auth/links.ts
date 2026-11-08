import "server-only";

import { siteConfig } from "@/config/site";
import type { Db } from "@/db";
import { env } from "@/env";
import { randomToken, sha256 } from "@/lib/admin/auth/crypto";
import { saveToken, type TokenPurpose } from "@/lib/admin/auth/queries";
import { adminTranslator } from "@/lib/admin/translator";
import { roleName } from "@/lib/admin/role-name";
import type { AdminRole } from "@/lib/admin/permissions";
import { sendAdminEmail } from "@/lib/emails";

const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  verify_email: 7 * 24 * 60 * 60_000,
  reset_password: 60 * 60_000,
};

const PAGE: Record<TokenPurpose, string> = {
  verify_email: "/admin/verify-email",
  reset_password: "/admin/reset-password",
};

/**
 * Creates a single-use link for `purpose`. Links are built from `NEXT_PUBLIC_SITE_URL`, never the
 * request's Host header, so a forged header can't point a reset email at another site.
 */
export const createAuthLink = async (db: Db, adminUserId: number, purpose: TokenPurpose) => {
  const token = randomToken();
  await saveToken(db, {
    adminUserId,
    purpose,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  });
  return `${env.NEXT_PUBLIC_SITE_URL}${PAGE[purpose]}?token=${token}`;
};

const t = adminTranslator;

/**
 * Emails a new team member their set-up link. Returns false when email isn't configured or the
 * send fails, so the Team page can offer the link to share another way.
 */
export const sendInviteEmail = (
  to: { name: string; email: string },
  { link, role, invitedBy }: { link: string; role: AdminRole; invitedBy: string },
) =>
  sendAdminEmail({
    to: to.email,
    subject: t("auth.emails.invite.subject", { orgName: siteConfig.orgName }),
    heading: t("auth.emails.invite.heading", { name: to.name }),
    paragraphs: [
      t("auth.emails.invite.added", {
        invitedBy,
        orgName: siteConfig.orgName,
        role: roleName(role),
      }),
      t("auth.emails.invite.instructions"),
    ],
    link: { label: t("auth.emails.invite.button"), href: link },
    footer: [t("auth.emails.invite.footer")],
  });

export const sendPasswordResetEmail = (to: { email: string }, link: string) =>
  sendAdminEmail({
    to: to.email,
    subject: t("auth.emails.reset.subject"),
    heading: t("auth.emails.reset.heading"),
    paragraphs: [t("auth.emails.reset.instructions", { email: to.email })],
    link: { label: t("auth.emails.reset.button"), href: link },
    footer: [t("auth.emails.reset.footer")],
  });
