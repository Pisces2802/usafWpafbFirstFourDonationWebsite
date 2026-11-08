"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthAlert, AuthHeading, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import { useAuthForm } from "@/hooks/use-auth-form";
import { verifyRecoveryCode, verifyTotpCode } from "@/lib/admin/auth/actions";
import { recoveryCodeSchema, totpCodeSchema } from "@/lib/admin/auth/schema";

const AppCodeForm = ({ next }: { next?: string }) => {
  const t = useTranslations("Admin.auth");
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: totpCodeSchema,
    defaultValues: { code: "" },
    action: (values) => verifyTotpCode(values, next),
  });
  const codeError = fieldError("code");

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      {error === "expired" && <StartOver />}
      <TextField
        id="totp-code"
        label={t("twoFactor.code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        autoFocus
        className="[&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.3em]"
        error={codeError && t(`errors.${codeError}` as Parameters<typeof t>[0])}
        {...register("code")}
      />
      <AuthSubmit
        isSubmitting={isSubmitting}
        label={t("twoFactor.submit")}
        submittingLabel={t("twoFactor.submitting")}
      />
    </form>
  );
};

const RecoveryCodeForm = ({ next }: { next?: string }) => {
  const t = useTranslations("Admin.auth");
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: recoveryCodeSchema,
    defaultValues: { code: "" },
    action: (values) => verifyRecoveryCode(values, next),
  });
  const codeError = fieldError("code");

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">{t("twoFactor.recoveryLead")}</p>
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      {error === "expired" && <StartOver />}
      <TextField
        id="recovery-code"
        label={t("twoFactor.recoveryCode")}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        autoFocus
        className="[&_input]:font-mono"
        error={codeError && t(`errors.${codeError}` as Parameters<typeof t>[0])}
        {...register("code")}
      />
      <AuthSubmit
        isSubmitting={isSubmitting}
        label={t("twoFactor.submit")}
        submittingLabel={t("twoFactor.submitting")}
      />
    </form>
  );
};

const StartOver = () => {
  const t = useTranslations("Admin.auth.twoFactor");
  return (
    <Link
      href="/admin/sign-in"
      className="text-primary -mt-2 text-sm font-medium underline-offset-4 hover:underline"
    >
      {t("startOver")}
    </Link>
  );
};

/** The code step of signing in, with a switch to recovery codes. */
export const TwoFactorVerify = ({ next }: { next?: string }) => {
  const t = useTranslations("Admin.auth.twoFactor");
  const [useRecovery, setUseRecovery] = useState(false);

  return (
    <>
      <AuthHeading title={t("title")} lead={useRecovery ? undefined : t("lead")} />
      {useRecovery ? <RecoveryCodeForm next={next} /> : <AppCodeForm next={next} />}
      <div className="mt-6 flex flex-col items-start gap-3">
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-11 px-0"
          onClick={() => setUseRecovery((value) => !value)}
        >
          {useRecovery ? t("useApp") : t("useRecovery")}
        </Button>
        {useRecovery && <p className="text-muted-foreground text-sm">{t("lostAccess")}</p>}
      </div>
    </>
  );
};
