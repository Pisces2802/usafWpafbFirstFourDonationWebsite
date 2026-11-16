"use server";

import { refresh } from "next/cache";
import QRCode from "qrcode";

import { siteConfig } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  sha256,
} from "@/lib/admin/auth/crypto";
import { type EmailCodeResult, matchesEmailCode, sendEmailCode } from "@/lib/admin/auth/email-code";
import { checkCurrentPassword } from "@/lib/admin/auth/password-check";
import {
  claimTotpStep,
  clearEmailCode,
  clearSessionSetup,
  consumeRecoveryCode,
  disableTwoFactor,
  enableTwoFactor,
  MAX_TWO_FACTOR_ATTEMPTS,
  recordTwoFactorFailure,
  setPendingTotpSecret,
} from "@/lib/admin/auth/queries";
import {
  type AuthError,
  type AuthResult,
  recoveryCodeSchema,
  totpCodeSchema,
} from "@/lib/admin/auth/schema";
import { sendSecurityNotice } from "@/lib/admin/auth/security-email";
import {
  type CurrentSession,
  endSession,
  promoteCurrentSession,
  readSession,
} from "@/lib/admin/auth/session";
import { finishSignIn, recordCompletedSignIn, roleNeedsTwoFactor } from "@/lib/admin/auth/sign-in";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/admin/auth/totp";

type Method = "authenticator" | "email";

const EMAIL_RESULT_ERRORS: Record<Exclude<EmailCodeResult, "sent">, AuthError> = {
  cooldown: "codeCooldown",
  rateLimited: "rateLimited",
  unavailable: "emailUnavailable",
};

/* ------------------------------------------------------------------------------------------------
 * Signing in: the code step after the password.
 * --------------------------------------------------------------------------------------------- */

/** The session between password and code, for someone who already has a second step. */
const verifyingSession = async (method?: Method) => {
  const current = await readSession();
  if (current?.session.stage !== "two_factor" || !current.user.twoFactorMethod) return null;
  if (method && current.user.twoFactorMethod !== method) return null;
  return current;
};

/** A wrong code counts against the session; after five, it ends and they sign in again. */
type Refused = { ok: false; error: AuthError };

const failSignInCode = async (current: CurrentSession): Promise<Refused> => {
  const attempts = await recordTwoFactorFailure(current.db, current.session.id);
  if (attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
    await recordAudit(current.db, { actor: current.user, action: "auth.two_factor_failed" });
    await endSession();
    return { ok: false, error: "expired" };
  }
  return { ok: false, error: "wrongCode" };
};

/** Accepts an authenticator code for someone who signs in with an app. */
export const verifyTotpCode = async (input: unknown, next?: unknown): Promise<AuthResult> => {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const current = await verifyingSession("authenticator");
  if (!current?.user.totpSecret) return { ok: false, error: "expired" };

  const step = verifyTotp(decryptSecret(current.user.totpSecret), parsed.data.code, {
    lastStep: current.user.totpLastStep,
  });
  if (step === null || !(await claimTotpStep(current.db, current.user.id, step))) {
    return failSignInCode(current);
  }
  return { ok: true, next: await finishSignIn(current, next, "authenticator") };
};

/** Accepts the code emailed at sign-in. */
export const verifyEmailCode = async (input: unknown, next?: unknown): Promise<AuthResult> => {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const current = await verifyingSession("email");
  if (!current) return { ok: false, error: "expired" };

  if (!matchesEmailCode(current.session, parsed.data.code)) return failSignInCode(current);
  await clearEmailCode(current.db, current.session.id);
  return { ok: true, next: await finishSignIn(current, next, "email") };
};

/** Emails a new sign-in code; the old one stops working. */
export const resendSignInCode = async (): Promise<AuthResult> => {
  const current = await verifyingSession("email");
  if (!current) return { ok: false, error: "expired" };
  const result = await sendEmailCode(current.db, current.session, current.user);
  return result === "sent" ? { ok: true } : { ok: false, error: EMAIL_RESULT_ERRORS[result] };
};

/** Accepts a single-use recovery code instead of the usual second step. */
export const verifyRecoveryCode = async (input: unknown, next?: unknown): Promise<AuthResult> => {
  const parsed = recoveryCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const current = await verifyingSession();
  if (!current) return { ok: false, error: "expired" };

  const codeHash = sha256(normalizeRecoveryCode(parsed.data.code));
  if (!(await consumeRecoveryCode(current.db, current.user.id, codeHash))) {
    return failSignInCode(current);
  }
  return { ok: true, next: await finishSignIn(current, next, "recovery_code") };
};

/* ------------------------------------------------------------------------------------------------
 * Choosing or changing a second step. Three places use these: the first sign-in after an invite,
 * a signed-in person whose new role needs it, and Settings. Once signed in, the current password
 * is asked for first, so someone using a session left open can't swap in their own phone or
 * turn the second step off.
 * --------------------------------------------------------------------------------------------- */

/**
 * The session a setup step runs in: between password and code for someone with no second step
 * yet, or signed in. Starting something once signed in (`checkPassword`) needs their current
 * password; finishing it doesn't, since only a session that passed that check has anything
 * pending to finish.
 */
const setupSession = async ({
  checkPassword,
  password,
}: {
  checkPassword: boolean;
  password?: unknown;
}): Promise<{ current: CurrentSession } | { error: AuthError }> => {
  const current = await readSession();
  if (!current) return { error: "expired" };
  if (current.session.stage === "two_factor") {
    return current.user.twoFactorMethod ? { error: "expired" } : { current };
  }
  if (!checkPassword) return { current };

  const checked = await checkCurrentPassword(current.db, current.user, password);
  return checked === "ok" ? { current } : { error: checked };
};

/**
 * A wrong code during setup. Before sign-in it counts like any wrong code; once signed in, five
 * wrong codes drop the half-finished setup rather than signing them out.
 */
const failSetupCode = async (current: CurrentSession): Promise<Refused> => {
  if (current.session.stage === "two_factor") return failSignInCode(current);
  const attempts = await recordTwoFactorFailure(current.db, current.session.id);
  if (attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
    await clearSessionSetup(current.db, current.session.id);
    return { ok: false, error: "expired" };
  }
  return { ok: false, error: "wrongCode" };
};

/**
 * Saves the confirmed method with new recovery codes. Before sign-in, this also signs them in;
 * once signed in, it records the change and emails them about it.
 */
const completeSetup = async (
  current: CurrentSession,
  next: unknown,
  method: Method,
  totp?: { encryptedSecret: string; step: number },
): Promise<AuthResult<{ recoveryCodes: string[] }>> => {
  const previous = current.user.twoFactorMethod;
  const recoveryCodes = generateRecoveryCodes();
  await enableTwoFactor(current.db, {
    adminUserId: current.user.id,
    method,
    encryptedSecret: totp?.encryptedSecret ?? null,
    step: totp?.step ?? null,
    recoveryCodeHashes: recoveryCodes.map((code) => sha256(normalizeRecoveryCode(code))),
  });

  if (current.session.stage === "two_factor") {
    await promoteCurrentSession(current);
    await recordAudit(current.db, {
      actor: current.user,
      action: "auth.two_factor_enabled",
      details: { method },
    });
    await recordCompletedSignIn(current.db, current.user, method);
  } else {
    await clearSessionSetup(current.db, current.session.id);
    await recordAudit(current.db, {
      actor: current.user,
      action: previous ? "account.two_factor_changed" : "auth.two_factor_enabled",
      details: previous ? { from: previous, to: method } : { method },
    });
    await sendSecurityNotice(current.user, previous ? "twoFactorChanged" : "twoFactorEnabled");
    // No refresh here: re-rendering the setup page would move on before the recovery codes show.
    // The screen refreshes itself once they've saved them.
  }
  return { ok: true, recoveryCodes, next: safeNextPath(next) };
};

/**
 * Starts authenticator setup: makes a secret, keeps it (encrypted) on the session until it's
 * confirmed, and returns it with a QR code for their app. A server action rather than part of the
 * page, so prefetching or reloading never makes a secret on its own.
 */
export const beginAuthenticatorSetup = async (
  password?: unknown,
): Promise<AuthResult<{ secret: string; qrCode: string }>> => {
  const setup = await setupSession({ checkPassword: true, password });
  if ("error" in setup) return { ok: false, error: setup.error };
  const { current } = setup;

  const secret = generateTotpSecret();
  await setPendingTotpSecret(current.db, current.session.id, encryptSecret(secret));
  const uri = totpUri({ secret, account: current.user.email, issuer: siteConfig.orgName });
  const qrCode = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { ok: true, secret: secret.match(/.{1,4}/g)!.join(" "), qrCode };
};

/** Confirms the app with a code from it, saves it and returns new recovery codes. */
export const confirmAuthenticatorSetup = async (
  input: unknown,
  next?: unknown,
): Promise<AuthResult<{ recoveryCodes: string[] }>> => {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const setup = await setupSession({ checkPassword: false });
  if ("error" in setup) return { ok: false, error: setup.error };
  const { current } = setup;
  const pending = current.session.pendingTotpSecret;
  if (!pending) return { ok: false, error: "expired" };

  const step = verifyTotp(decryptSecret(pending), parsed.data.code);
  if (step === null) return failSetupCode(current);
  return completeSetup(current, next, "authenticator", { encryptedSecret: pending, step });
};

/** Starts email setup by sending a code to their address, to show that it reaches them. */
export const beginEmailSetup = async (password?: unknown): Promise<AuthResult> => {
  const setup = await setupSession({ checkPassword: true, password });
  if ("error" in setup) return { ok: false, error: setup.error };
  const { current } = setup;
  if (current.user.twoFactorMethod === "email") return { ok: false, error: "expired" };

  const result = await sendEmailCode(current.db, current.session, current.user);
  return result === "sent" ? { ok: true } : { ok: false, error: EMAIL_RESULT_ERRORS[result] };
};

/** Confirms the emailed code, switches them to emailed codes and returns new recovery codes. */
export const confirmEmailSetup = async (
  input: unknown,
  next?: unknown,
): Promise<AuthResult<{ recoveryCodes: string[] }>> => {
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrongCode" };
  const setup = await setupSession({ checkPassword: false });
  if ("error" in setup) return { ok: false, error: setup.error };
  const { current } = setup;
  if (current.user.twoFactorMethod === "email") return { ok: false, error: "expired" };

  if (!matchesEmailCode(current.session, parsed.data.code)) return failSetupCode(current);
  return completeSetup(current, next, "email");
};

/** After an invite, carries on without a second step, where their role allows it. */
export const skipTwoFactorSetup = async (next?: unknown): Promise<AuthResult> => {
  const current = await readSession();
  if (current?.session.stage !== "two_factor" || current.user.twoFactorMethod) {
    return { ok: false, error: "expired" };
  }
  if (roleNeedsTwoFactor(current.role)) return { ok: false, error: "twoFactorRequired" };

  await promoteCurrentSession(current);
  await recordCompletedSignIn(current.db, current.user, "password");
  return { ok: true, next: safeNextPath(next) };
};

/**
 * Turns off the second step from Settings, after checking their password. Refused for anyone
 * whose role holds an `identity:` or `auth:` permission: they can switch methods, not go without.
 */
export const turnOffTwoFactor = async (password: unknown): Promise<AuthResult> => {
  const setup = await setupSession({ checkPassword: true, password });
  if ("error" in setup) return { ok: false, error: setup.error };
  const { current } = setup;
  if (current.session.stage !== "active" || !current.user.twoFactorMethod) {
    return { ok: false, error: "expired" };
  }
  if (roleNeedsTwoFactor(current.role)) return { ok: false, error: "twoFactorRequired" };

  await disableTwoFactor(current.db, current.user.id);
  await recordAudit(current.db, {
    actor: current.user,
    action: "account.two_factor_turned_off",
    details: { method: current.user.twoFactorMethod },
  });
  await sendSecurityNotice(current.user, "twoFactorTurnedOff");
  refresh();
  return { ok: true };
};
