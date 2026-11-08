"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { AuthAlert, AuthNotice } from "@/components/admin/auth/auth-parts";
import { RecoveryCodes } from "@/components/admin/auth/recovery-codes";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import { useAuthForm } from "@/hooks/use-auth-form";
import {
  changePassword,
  regenerateRecoveryCodes,
  signOutOtherSessions,
  updateName,
} from "@/lib/admin/auth/account-actions";
import { changePasswordSchema, nameSchema } from "@/lib/admin/auth/schema";
import type { AuthError } from "@/lib/admin/auth/schema";

const useErrorText = () => {
  const t = useTranslations("Admin.auth.errors");
  return (key: string | null | undefined) => key && t(key as Parameters<typeof t>[0]);
};

export const NameForm = ({ name }: { name: string }) => {
  const t = useTranslations("Admin.settings.profile");
  const errorText = useErrorText();
  const { register, submit, fieldError, error, isSubmitting, isSubmitSuccessful } = useAuthForm({
    schema: nameSchema,
    defaultValues: { name },
    action: updateName,
    onSuccess: () => {},
  });

  return (
    <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <AuthAlert>{errorText(error)}</AuthAlert>
      <TextField
        id="settings-name"
        label={t("name")}
        autoComplete="name"
        error={errorText(fieldError("name"))}
        {...register("name")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="touch" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
        {isSubmitSuccessful && !isSubmitting && <AuthNotice>{t("saved")}</AuthNotice>}
      </div>
    </form>
  );
};

export const ChangePasswordForm = ({ email }: { email: string }) => {
  const t = useTranslations("Admin");
  const errorText = useErrorText();
  const [saved, setSaved] = useState(false);
  const { register, submit, reset, fieldError, error, isSubmitting } = useAuthForm({
    schema: changePasswordSchema,
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
    action: changePassword,
    onSuccess: () => {
      setSaved(true);
      reset();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        setSaved(false);
        void submit(event);
      }}
      className="flex max-w-md flex-col gap-4"
    >
      <AuthAlert>{errorText(error)}</AuthAlert>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <TextField
        id="current-password"
        type="password"
        label={t("auth.currentPassword")}
        autoComplete="current-password"
        error={errorText(fieldError("currentPassword"))}
        {...register("currentPassword")}
      />
      <TextField
        id="settings-new-password"
        type="password"
        label={t("auth.newPassword")}
        hint={t("auth.passwordHint")}
        autoComplete="new-password"
        error={errorText(fieldError("password"))}
        {...register("password")}
      />
      <TextField
        id="settings-confirm-password"
        type="password"
        label={t("auth.confirmPassword")}
        autoComplete="new-password"
        error={errorText(fieldError("confirmPassword"))}
        {...register("confirmPassword")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="touch" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? t("settings.password.submitting") : t("settings.password.submit")}
        </Button>
        {saved && <AuthNotice>{t("settings.password.saved")}</AuthNotice>}
      </div>
    </form>
  );
};

/** Runs a settings action that takes no input, tracking its pending state and refusal. */
const useAccountAction = <TResult extends { ok: boolean }>(action: () => Promise<TResult>) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<AuthError | "unknown" | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const run = () =>
    startTransition(async () => {
      setError(null);
      try {
        const response = await action();
        if (response.ok) setResult(response);
        else setError((response as unknown as { error: AuthError }).error);
      } catch {
        setError("unknown");
      }
    });

  return { run, isPending, error, result, clear: () => setResult(null) };
};

export const RecoveryCodesPanel = ({ remaining }: { remaining: number }) => {
  const t = useTranslations("Admin.settings.twoFactor");
  const errorText = useErrorText();
  const { run, isPending, error, result, clear } = useAccountAction(regenerateRecoveryCodes);
  const codes = result?.ok ? result.recoveryCodes : null;

  if (codes) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <RecoveryCodes codes={codes} />
        <Button type="button" size="touch" className="w-fit" onClick={clear}>
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={remaining === 0 ? "text-destructive" : undefined}>
        {t("remaining", { count: remaining })}
      </p>
      <AuthAlert>{errorText(error)}</AuthAlert>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="touch" variant="outline" disabled={isPending} onClick={run}>
          {isPending ? t("regenerating") : t("regenerate")}
        </Button>
        <span className="text-muted-foreground text-sm">{t("regenerateHint")}</span>
      </div>
    </div>
  );
};

export const SessionsPanel = ({ otherSessions }: { otherSessions: number }) => {
  const t = useTranslations("Admin.settings.sessions");
  const errorText = useErrorText();
  const { run, isPending, error } = useAccountAction(signOutOtherSessions);

  return (
    <div className="flex flex-col gap-3">
      <p>{t("others", { count: otherSessions })}</p>
      <AuthAlert>{errorText(error)}</AuthAlert>
      {otherSessions > 0 && (
        <Button
          type="button"
          size="touch"
          variant="outline"
          className="w-fit"
          disabled={isPending}
          onClick={run}
        >
          {isPending ? t("signingOut") : t("signOutOthers")}
        </Button>
      )}
    </div>
  );
};
