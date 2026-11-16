"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { env } from "@/env";
import { recordAudit } from "@/lib/admin/audit";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import {
  getDummyHash,
  hashPassword,
  isAuthConfigured,
  sha256,
  verifyPassword,
} from "@/lib/admin/auth/crypto";
import { sendEmailCode } from "@/lib/admin/auth/email-code";
import { createAuthLink, sendPasswordResetEmail } from "@/lib/admin/auth/links";
import { sendSecurityNotice } from "@/lib/admin/auth/security-email";
import {
  clearFailedSignIns,
  findAdminByEmail,
  findAdminById,
  LOCKOUT_MS,
  MAX_FAILED_SIGN_INS_PER_ADDRESS,
  recordFailedSignIn,
  setPasswordWithToken,
} from "@/lib/admin/auth/queries";
import {
  type AuthResult,
  forgotPasswordSchema,
  signInSchema,
  tokenPasswordSchema,
} from "@/lib/admin/auth/schema";
import { endSession, readSession, startSession } from "@/lib/admin/auth/session";
import { recordCompletedSignIn, roleNeedsTwoFactor } from "@/lib/admin/auth/sign-in";
import { findRole } from "@/lib/admin/role-queries";
import { clearHits, countHits, getClientIp, isRateLimited, recordHit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const FIFTEEN_MINUTES = 15 * 60_000;

const authDb = () => (isAuthConfigured() ? getDb() : null);

const clientKey = async (scope: string) =>
  `admin-${scope}:${getClientIp(await headers()) ?? "unknown"}`;

/**
 * Turnstile for the signed-out forms. Checked only when a secret key is set: unlike the public
 * forms, a missing key must never lock the team out of the back office.
 */
const passesTurnstile = async (token: unknown) => {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  const ip = getClientIp(await headers());
  return (await verifyTurnstile(typeof token === "string" ? token : undefined, ip)) === "ok";
};

type AuthDb = NonNullable<ReturnType<typeof authDb>>;

/** Wrong passwords for one account from one network address; see `MAX_FAILED_SIGN_INS_PER_ADDRESS`. */
const addressFailures = (db: AuthDb, userId: number, ip: string | null) => {
  const key = `admin-sign-in-fail:${userId}:${ip ?? "unknown"}`;
  // A failed count must not block signing in, so errors are logged and treated as no failures.
  const attempt = async <T>(run: () => Promise<T>, fallback: T) => {
    try {
      return await run();
    } catch (error) {
      console.error("Sign-in failure count unavailable", error);
      return fallback;
    }
  };
  return {
    isLocked: () =>
      attempt(
        async () => (await countHits(db, key, LOCKOUT_MS)) >= MAX_FAILED_SIGN_INS_PER_ADDRESS,
        false,
      ),
    record: () => attempt(() => recordHit(db, key, LOCKOUT_MS), 0),
    clear: () => attempt(() => clearHits(db, key), undefined),
  };
};

/** Checks email and password, then starts the two-factor step. */
export const signIn = async (
  input: unknown,
  next?: unknown,
  turnstileToken?: unknown,
): Promise<AuthResult> => {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = authDb();
  if (!db) return { ok: false, error: "unavailable" };
  if (await isRateLimited(await clientKey("sign-in"), { limit: 20, windowMs: FIFTEEN_MINUTES })) {
    return { ok: false, error: "rateLimited" };
  }
  if (!(await passesTurnstile(turnstileToken))) return { ok: false, error: "verificationFailed" };

  const { email, password } = parsed.data;
  const user = await findAdminByEmail(db, email);
  const failures = user && addressFailures(db, user.id, getClientIp(await headers()));

  const accountLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
  if (user && failures && (accountLocked || (await failures.isLocked()))) {
    await verifyPassword(password, await getDummyHash());
    await recordAudit(db, { actor: user, action: "auth.sign_in_locked" });
    return { ok: false, error: "locked" };
  }

  const matches = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.isActive || !user.passwordHash || !matches) {
    if (user?.passwordHash) {
      await recordFailedSignIn(db, user.id);
      await failures?.record();
    }
    await recordAudit(db, {
      actor: user ?? null,
      action: "auth.sign_in_failed",
      target: user ? null : email,
    });
    return { ok: false, error: "invalid" };
  }

  // A locked account only says so once the password is right, so the message can't be used to
  // find out who's on the team.
  if (user.suspendedAt) {
    await recordAudit(db, { actor: user, action: "auth.sign_in_while_locked" });
    return { ok: false, error: "suspended" };
  }

  await clearFailedSignIns(db, user.id);
  await failures?.clear();
  const target = safeNextPath(next);

  // No second step, allowed for their role and already chosen: the first sign-in offers one.
  if (
    !user.twoFactorMethod &&
    user.lastSignInAt &&
    !roleNeedsTwoFactor(await findRole(db, user.roleId))
  ) {
    await startSession(db, user.id, "active");
    await recordCompletedSignIn(db, user, "password");
    return { ok: true, next: target };
  }

  const session = await startSession(db, user.id, "two_factor");
  if (user.twoFactorMethod === "email") await sendEmailCode(db, session, user);
  return {
    ok: true,
    next: `/admin/two-factor${target === "/admin" ? "" : `?next=${encodeURIComponent(target)}`}`,
  };
};

/**
 * Emails a reset link if the address belongs to someone on the team. The answer is the same
 * either way, so the form can't be used to find out who has access.
 */
export const requestPasswordReset = async (
  input: unknown,
  turnstileToken?: unknown,
): Promise<AuthResult> => {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = authDb();
  if (!db) return { ok: false, error: "unavailable" };
  if (await isRateLimited(await clientKey("reset"), { limit: 5, windowMs: FIFTEEN_MINUTES })) {
    return { ok: false, error: "rateLimited" };
  }
  if (!(await passesTurnstile(turnstileToken))) return { ok: false, error: "verificationFailed" };

  const user = await findAdminByEmail(db, parsed.data.email);
  if (user?.isActive) {
    const link = await createAuthLink(db, user.id, "reset_password");
    await sendPasswordResetEmail(user, link);
  }
  return { ok: true };
};

const setPasswordFromLink = async (input: unknown, purpose: "verify_email" | "reset_password") => {
  const parsed = tokenPasswordSchema.safeParse(input);
  const db = authDb();
  if (!parsed.success || !db) return null;
  return {
    db,
    userId: await setPasswordWithToken(db, {
      purpose,
      tokenHash: sha256(parsed.data.token),
      passwordHash: await hashPassword(parsed.data.password),
    }),
  };
};

/** Sets a new password from a reset link and signs out every session. */
export const resetPassword = async (input: unknown): Promise<AuthResult> => {
  const result = await setPasswordFromLink(input, "reset_password");
  if (!result?.userId) return { ok: false, error: "linkInvalid" };
  const user = await findAdminById(result.db, result.userId);
  if (user) {
    await recordAudit(result.db, { actor: user, action: "auth.password_reset" });
    await sendSecurityNotice(user, "passwordReset");
  }
  return { ok: true, next: "/admin/sign-in?reset=1" };
};

/**
 * Finishes an invite: confirms the email, sets the password and goes straight on to choosing a
 * second step (or skipping it, where their role allows), since following the link already proved
 * they own the address.
 */
export const acceptInvite = async (input: unknown): Promise<AuthResult> => {
  const result = await setPasswordFromLink(input, "verify_email");
  if (!result?.userId) return { ok: false, error: "linkInvalid" };
  const user = await findAdminById(result.db, result.userId);
  if (user) await recordAudit(result.db, { actor: user, action: "auth.invite_accepted" });
  await startSession(result.db, result.userId, "two_factor");
  return { ok: true, next: "/admin/two-factor" };
};

export const signOut = async () => {
  const current = await readSession();
  if (current?.session.stage === "active") {
    await recordAudit(current.db, { actor: current.user, action: "auth.signed_out" });
  }
  await endSession();
  redirect("/admin/sign-in");
};
