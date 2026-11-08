"use client";

import { useTranslations } from "next-intl";

import { PasswordField } from "@/components/admin/auth/password-field";
import { AuthAlert, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { useAuthForm } from "@/hooks/use-auth-form";
import { acceptInvite, resetPassword } from "@/lib/admin/auth/actions";
import { newPasswordSchema } from "@/lib/admin/auth/schema";

const ACTIONS = { verify: acceptInvite, reset: resetPassword };

type SetPasswordFormProps = {
  token: string;
  /** `verify` finishes an invite; `reset` is a forgotten password. */
  purpose: keyof typeof ACTIONS;
  /** Prefills a hidden username field so password managers save the right account. */
  email: string;
};

/** New password and confirmation, sent with the token from the emailed link. */
export const SetPasswordForm = ({ token, purpose, email }: SetPasswordFormProps) => {
  const t = useTranslations("Admin.auth");
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: newPasswordSchema,
    defaultValues: { password: "", confirmPassword: "" },
    action: (values) => ACTIONS[purpose]({ ...values, token }),
  });
  const message = (key: string | undefined) => key && t(`errors.${key}` as Parameters<typeof t>[0]);

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        id="new-password"
        label={t("newPassword")}
        hint={t("passwordHint")}
        autoComplete="new-password"
        autoFocus
        error={message(fieldError("password"))}
        {...register("password")}
      />
      <PasswordField
        id="confirm-password"
        label={t("confirmPassword")}
        autoComplete="new-password"
        error={message(fieldError("confirmPassword"))}
        {...register("confirmPassword")}
      />
      <AuthSubmit
        isSubmitting={isSubmitting}
        label={t(`${purpose}.submit`)}
        submittingLabel={t(`${purpose}.submitting`)}
      />
    </form>
  );
};
