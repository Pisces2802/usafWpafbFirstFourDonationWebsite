"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { siteConfig } from "@/config/site";
import { getDb } from "@/db";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  getDummyHash,
  hashPassword,
  isAuthConfigured,
  normalizeRecoveryCode,
  sha256,
  verifyPassword,
} from "@/lib/admin/auth/crypto";
import { createAuthLink, sendPasswordResetEmail } from "@/lib/admin/auth/links";
import {
  claimTotpStep,
  clearFailedSignIns,
  enableTwoFactor,
  findAdminByEmail,
  MAX_TWO_FACTOR_ATTEMPTS,
  recordFailedSignIn,
  recordSignIn,
  recordTwoFactorFailure,
  setPasswordWithToken,
  setPendingTotpSecret,
  consumeRecoveryCode,
} from "@/lib/admin/auth/queries";
import {
  type AuthResult,
  forgotPasswordSchema,
  recoveryCodeSchema,
  signInSchema,
  tokenPasswordSchema,
  totpCodeSchema,
} from "@/lib/admin/auth/schema";
import {
  type CurrentSession,
  endSession,
  promoteCurrentSession,
  readSession,
  replaceSession,
  startSession,
} from "@/lib/admin/auth/session";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/admin/auth/totp";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const FIFTEEN_MINUTES = 15 * 60_000;

const authDb = () => (isAuthConfigured() ? getDb() : null);

const clientKey = async (scope: string) =>
  `admin-${scope}:${getClientIp(await headers()) ?? "unknown"}`;

/** Checks email and password, then starts the two-factor step. */
export const signIn = async (input: unknown, next?: unknown): Promise<AuthResult> => {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = authDb();
  if (!db) return { ok: false, error: "unavailable" };
  if (isRateLimited(await clientKey("sign-in"), { limit: 20, windowMs: FIFTEEN_MINUTES })) {
    return { ok: false, error: "rateLimited" };
  }

  const { email, password } = parsed.data;
  const user = await findAdminByEmail(db, email);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(password, await getDummyHash());
    return { ok: false, error: "locked" };
  }

  const matches = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.isActive || !user.passwordHash || !matches) {
    if (user?.passwordHash) await recordFailedSignIn(db, user.id);
    return { ok: false, error: "invalid" };
  }

  await clearFailedSignIns(db, user.id);
  await startSession(db, user.id, "two_factor");
  const target = safeNextPath(next);
  return {
    ok: true,
    next: `/admin/two-factor${target === "/admin" ? "" : `?next=${encodeURIComponent(target)}`}`,
  };
};

const twoFactorSession = async () => {
  const current = await readSession();
  return current?.session.stage === "two_factor" ? current : null;
};

/** A wrong code counts against the session; after five, it ends and they sign in again. */
const failCode = async (current: CurrentSession): Promise<AuthResult> => {
  const attempts = await recordTwoFactorFailure(current.db, current.session.id);
  if (attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
    await endSession();
    return { ok: false, error: "expired" };
  }
  return { ok: false, error: "wrongCode" };
};

const finishSignIn = async (current: CurrentSession, next: unknown) => {
  await replaceSession(current, "active");
  await recordSignIn(current.db, current.user.id);
  return safeNextPath(next);
};

/** Accepts an authenticator code for someone who has two-factor set up. */
export const verifyTotpCode = async (input: unknown, next?: unknown): Promise<AuthResult> => {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const current = await twoFactorSession();
  if (!current?.user.totpSecret) return { ok: false, error: "expired" };

  const step = verifyTotp(decryptSecret(current.user.totpSecret), parsed.data.code, {
    lastStep: current.user.totpLastStep,
  });
  if (step === null || !(await claimTotpStep(current.db, current.user.id, step))) {
    return failCode(current);
  }
  return { ok: true, next: await finishSignIn(current, next) };
};

/** Accepts a single-use recovery code instead of an authenticator code. */
export const verifyRecoveryCode = async (input: unknown, next?: unknown): Promise<AuthResult> => {
  const parsed = recoveryCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const current = await twoFactorSession();
  if (!current?.user.totpSecret) return { ok: false, error: "expired" };

  const codeHash = sha256(normalizeRecoveryCode(parsed.data.code));
  if (!(await consumeRecoveryCode(current.db, current.user.id, codeHash))) return failCode(current);
  return { ok: true, next: await finishSignIn(current, next) };
};

/**
 * Starts two-factor setup for someone who hasn't done it: makes a secret, keeps it (encrypted)
 * on the session until it's confirmed, and returns it with a QR code for their app.
 */
export const beginTwoFactorSetup = async (): Promise<
  AuthResult<{ secret: string; qrCode: string }>
> => {
  const current = await twoFactorSession();
  if (!current || current.user.totpSecret) return { ok: false, error: "expired" };

  const secret = generateTotpSecret();
  await setPendingTotpSecret(current.db, current.session.id, encryptSecret(secret));
  const uri = totpUri({ secret, account: current.user.email, issuer: siteConfig.orgName });
  const qrCode = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });

  return { ok: true, secret: secret.match(/.{1,4}/g)!.join(" "), qrCode };
};

/**
 * Confirms setup with a code from the app, saves the secret, signs them in and returns their
 * recovery codes. This is the only time the codes are shown in full.
 */
export const confirmTwoFactorSetup = async (
  input: unknown,
  next?: unknown,
): Promise<AuthResult<{ recoveryCodes: string[] }>> => {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const current = await twoFactorSession();
  if (!current?.session.pendingTotpSecret || current.user.totpSecret) {
    return { ok: false, error: "expired" };
  }

  const step = verifyTotp(decryptSecret(current.session.pendingTotpSecret), parsed.data.code);
  if (step === null) {
    const failed = await failCode(current);
    return failed.ok ? { ok: false, error: "wrongCode" } : failed;
  }

  const recoveryCodes = generateRecoveryCodes();
  await enableTwoFactor(current.db, {
    adminUserId: current.user.id,
    encryptedSecret: current.session.pendingTotpSecret,
    step,
    recoveryCodeHashes: recoveryCodes.map((code) => sha256(normalizeRecoveryCode(code))),
  });
  await promoteCurrentSession(current);
  await recordSignIn(current.db, current.user.id);
  return { ok: true, recoveryCodes, next: safeNextPath(next) };
};

/**
 * Emails a reset link if the address belongs to someone on the team. The answer is the same
 * either way, so the form can't be used to find out who has access.
 */
export const requestPasswordReset = async (input: unknown): Promise<AuthResult> => {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = authDb();
  if (!db) return { ok: false, error: "unavailable" };
  if (isRateLimited(await clientKey("reset"), { limit: 5, windowMs: FIFTEEN_MINUTES })) {
    return { ok: false, error: "rateLimited" };
  }

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
  return { ok: true, next: "/admin/sign-in?reset=1" };
};

/**
 * Finishes an invite: confirms the email, sets the password and goes straight on to two-factor
 * setup, since following the link already proved they own the address.
 */
export const acceptInvite = async (input: unknown): Promise<AuthResult> => {
  const result = await setPasswordFromLink(input, "verify_email");
  if (!result?.userId) return { ok: false, error: "linkInvalid" };
  await startSession(result.db, result.userId, "two_factor");
  return { ok: true, next: "/admin/two-factor" };
};

export const signOut = async () => {
  await endSession();
  redirect("/admin/sign-in");
};
