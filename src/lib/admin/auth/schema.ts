import { z } from "zod";

/** Error messages are keys into `Admin.auth.errors`, so forms can show translated text. */
const email = z.string().trim().toLowerCase().pipe(z.email("email").max(254, "email"));

/** Length is the only rule, following NIST 800-63B: at least 12 characters, at most 128. */
const newPassword = z.string().min(12, "passwordLength").max(128, "passwordLength");
const currentPassword = z.string().min(1, "passwordRequired").max(128, "passwordRequired");

const matching = <T extends { password: string; confirmPassword: string }>(value: T) =>
  value.password === value.confirmPassword;
const mismatch = { path: ["confirmPassword"], message: "passwordMismatch" };

export const signInSchema = z.object({ email, password: currentPassword });

export const forgotPasswordSchema = z.object({ email });

const passwordPair = { password: newPassword, confirmPassword: z.string() };

export const newPasswordSchema = z.object(passwordPair).refine(matching, mismatch);

/** Server side of the reset and verify-email forms: the new password plus the emailed token. */
export const tokenPasswordSchema = z
  .object({ ...passwordPair, token: z.string().min(20).max(200) })
  .refine(matching, mismatch);

export const changePasswordSchema = z
  .object({ currentPassword, ...passwordPair })
  .refine(matching, mismatch);

/** A 6-digit authenticator code; spaces are allowed since apps show `123 456`. */
export const totpCodeSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "code")),
});

export const recoveryCodeSchema = z.object({
  code: z.string().trim().min(10, "recoveryCode").max(24, "recoveryCode"),
});

export const nameSchema = z.object({ name: z.string().trim().min(1, "name").max(120, "name") });

export const AUTH_ERRORS = [
  "invalid",
  "locked",
  "rateLimited",
  "unavailable",
  "expired",
  "wrongCode",
  "wrongPassword",
  "linkInvalid",
] as const;
export type AuthError = (typeof AUTH_ERRORS)[number];

/** What every auth action returns. `next` is where to go on success. */
export type AuthResult<TData = object> =
  ({ ok: true; next?: string } & TData) | { ok: false; error: AuthError };
