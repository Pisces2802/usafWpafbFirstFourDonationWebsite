"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthAlert, AuthHeading, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { TextField } from "@/components/donation/text-field";
import { useAuthForm } from "@/hooks/use-auth-form";
import { requestPasswordReset } from "@/lib/admin/auth/actions";
import { forgotPasswordSchema } from "@/lib/admin/auth/schema";

const BackToSignIn = ({ label }: { label: string }) => (
  <Link
    href="/admin/sign-in"
    className="text-primary mt-6 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
  >
    {label}
  </Link>
);

export const ForgotPasswordForm = () => {
  const t = useTranslations("Admin.auth");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    action: requestPasswordReset,
    onSuccess: (_result, values) => setSentTo(values.email),
  });

  if (sentTo) {
    return (
      <div role="status">
        <AuthHeading title={t("forgot.sentTitle")} lead={t("forgot.sent", { email: sentTo })} />
        <BackToSignIn label={t("forgot.back")} />
      </div>
    );
  }

  const emailError = fieldError("email");

  return (
    <>
      <AuthHeading title={t("forgot.title")} lead={t("forgot.lead")} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
        <TextField
          id="forgot-email"
          type="email"
          label={t("email")}
          autoComplete="username"
          spellCheck={false}
          autoFocus
          error={emailError && t(`errors.${emailError}` as Parameters<typeof t>[0])}
          {...register("email")}
        />
        <AuthSubmit
          isSubmitting={isSubmitting}
          label={t("forgot.submit")}
          submittingLabel={t("forgot.submitting")}
        />
      </form>
      <BackToSignIn label={t("forgot.back")} />
    </>
  );
};
