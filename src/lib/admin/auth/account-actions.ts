"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { recordAudit } from "@/lib/admin/audit";

import {
  generateRecoveryCodes,
  hashPassword,
  normalizeRecoveryCode,
  sha256,
  verifyPassword,
} from "@/lib/admin/auth/crypto";
import {
  changePassword as savePassword,
  deleteOtherSessions,
  replaceRecoveryCodes,
  updateAdminName,
} from "@/lib/admin/auth/queries";
import { type AuthResult, changePasswordSchema, nameSchema } from "@/lib/admin/auth/schema";
import { sendSecurityNotice } from "@/lib/admin/auth/security-email";
import { readSession } from "@/lib/admin/auth/session";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

/** The signed-in session, or null. Every settings action starts here. */
const activeSession = async () => {
  const current = await readSession();
  return current?.session.stage === "active" ? current : null;
};

export const updateName = async (input: unknown): Promise<AuthResult> => {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = await activeSession();
  if (!current) return { ok: false, error: "expired" };

  await updateAdminName(current.db, current.user.id, parsed.data.name);
  if (parsed.data.name !== current.user.name) {
    await recordAudit(current.db, {
      actor: { ...current.user, name: parsed.data.name },
      action: "account.name_changed",
      details: { from: current.user.name, to: parsed.data.name },
    });
  }
  refresh();
  return { ok: true };
};

/** Needs the current password. Other devices are signed out; this one stays signed in. */
export const changePassword = async (input: unknown): Promise<AuthResult> => {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = await activeSession();
  if (!current?.user.passwordHash) return { ok: false, error: "expired" };

  const ip = getClientIp(await headers()) ?? "unknown";
  if (
    isRateLimited(`admin-password:${current.user.id}:${ip}`, { limit: 5, windowMs: 15 * 60_000 })
  ) {
    return { ok: false, error: "rateLimited" };
  }
  if (!(await verifyPassword(parsed.data.currentPassword, current.user.passwordHash))) {
    return { ok: false, error: "wrongPassword" };
  }

  await savePassword(current.db, {
    adminUserId: current.user.id,
    passwordHash: await hashPassword(parsed.data.password),
    keepSessionId: current.session.id,
  });
  await recordAudit(current.db, { actor: current.user, action: "account.password_changed" });
  await sendSecurityNotice(current.user, "passwordChanged");
  refresh();
  return { ok: true };
};

/** Replaces all recovery codes; the old ones stop working. The new ones are shown once. */
export const regenerateRecoveryCodes = async (): Promise<
  AuthResult<{ recoveryCodes: string[] }>
> => {
  const current = await activeSession();
  if (!current) return { ok: false, error: "expired" };

  const recoveryCodes = generateRecoveryCodes();
  await replaceRecoveryCodes(
    current.db,
    current.user.id,
    recoveryCodes.map((code) => sha256(normalizeRecoveryCode(code))),
  );
  await recordAudit(current.db, {
    actor: current.user,
    action: "account.recovery_codes_regenerated",
  });
  await sendSecurityNotice(current.user, "recoveryCodesRegenerated");
  refresh();
  return { ok: true, recoveryCodes };
};

export const signOutOtherSessions = async (): Promise<AuthResult> => {
  const current = await activeSession();
  if (!current) return { ok: false, error: "expired" };

  await deleteOtherSessions(current.db, current.user.id, current.session.id);
  await recordAudit(current.db, { actor: current.user, action: "account.other_sessions_ended" });
  refresh();
  return { ok: true };
};
