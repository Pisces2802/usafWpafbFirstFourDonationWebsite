"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { AuthAlert, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { TextField } from "@/components/donation/text-field";
import { useAuthForm } from "@/hooks/use-auth-form";
import { signIn } from "@/lib/admin/auth/actions";
import { signInSchema } from "@/lib/admin/auth/schema";

export const SignInForm = ({ next }: { next?: string }) => {
  const t = useTranslations("Admin.auth");
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: signInSchema,
    defaultValues: { email: "", password: "" },
    action: (values) => signIn(values, next),
  });
  const message = (key: string | undefined) => key && t(`errors.${key}` as Parameters<typeof t>[0]);

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      <TextField
        id="sign-in-email"
        type="email"
        label={t("email")}
        autoComplete="username"
        spellCheck={false}
        autoFocus
        error={message(fieldError("email"))}
        {...register("email")}
      />
      <div className="flex flex-col gap-2">
        <TextField
          id="sign-in-password"
          type="password"
          label={t("password")}
          autoComplete="current-password"
          error={message(fieldError("password"))}
          {...register("password")}
        />
        <Link
          href="/admin/forgot-password"
          className="text-primary w-fit text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("signIn.forgot")}
        </Link>
      </div>
      <AuthSubmit
        isSubmitting={isSubmitting}
        label={t("signIn.submit")}
        submittingLabel={t("signIn.submitting")}
      />
    </form>
  );
};
