import "server-only";

import type { Db } from "@/db";
import { recordAudit } from "@/lib/admin/audit";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import { recordSignIn } from "@/lib/admin/auth/queries";
import { sendSecurityNotice } from "@/lib/admin/auth/security-email";
import { type CurrentSession, replaceSession } from "@/lib/admin/auth/session";
import { grantedPermissions, requiresTwoFactor, type RoleGrant } from "@/lib/admin/permissions";

/** How someone finished signing in, as recorded in the audit log. */
export type SignInMethod = "password" | "authenticator" | "email" | "recovery_code";

/** Whether this role's people must use a second step and can't turn it off. */
export const roleNeedsTwoFactor = (role: RoleGrant | undefined) =>
  role === undefined || requiresTwoFactor(grantedPermissions(role));

type SignedInPerson = Parameters<typeof sendSecurityNotice>[0] & {
  id: number;
  name: string;
  email: string;
};

/** Records a finished sign-in and tells them about it. The session must already be active. */
export const recordCompletedSignIn = async (db: Db, user: SignedInPerson, method: SignInMethod) => {
  await recordSignIn(db, user.id);
  await recordAudit(db, { actor: user, action: "auth.signed_in", details: { method } });
  await sendSecurityNotice(user, method === "recovery_code" ? "recoveryCodeUsed" : "signedIn");
};

/** Swaps a two-factor session for a signed-in one and returns where to go. */
export const finishSignIn = async (
  current: CurrentSession,
  next: unknown,
  method: SignInMethod,
) => {
  await replaceSession(current, "active");
  await recordCompletedSignIn(current.db, current.user, method);
  return safeNextPath(next);
};
