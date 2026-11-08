"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthAlert, AuthHeading, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { RecoveryCodes } from "@/components/admin/auth/recovery-codes";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import { useAuthForm } from "@/hooks/use-auth-form";
import { useCopy } from "@/hooks/use-copy";
import { useTwoFactorSetup } from "@/hooks/use-two-factor-setup";
import { confirmTwoFactorSetup } from "@/lib/admin/auth/actions";
import { totpCodeSchema } from "@/lib/admin/auth/schema";

const SavedCodes = ({ codes, next }: { codes: string[]; next: string }) => {
  const t = useTranslations("Admin.auth.setup");
  const router = useRouter();

  return (
    <>
      <AuthHeading title={t("codesTitle")} lead={t("codesLead")} />
      <RecoveryCodes codes={codes} />
      <Button
        type="button"
        size="touch"
        className="mt-6 w-full"
        onClick={() => router.replace(next)}
      >
        {t("continue")}
      </Button>
    </>
  );
};

/** First sign-in: scan the QR code, confirm a code, then save recovery codes. */
export const TwoFactorSetup = ({ next }: { next?: string }) => {
  const t = useTranslations("Admin.auth");
  const setup = useTwoFactorSetup();
  const { copied, copy } = useCopy();
  const [done, setDone] = useState<{ codes: string[]; next: string } | null>(null);
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: totpCodeSchema,
    defaultValues: { code: "" },
    action: (values) => confirmTwoFactorSetup(values, next),
    onSuccess: (result) => setDone({ codes: result.recoveryCodes, next: result.next ?? "/admin" }),
  });

  if (done) return <SavedCodes codes={done.codes} next={done.next} />;

  const codeError = fieldError("code");

  return (
    <>
      <AuthHeading title={t("setup.title")} lead={t("setup.lead")} />
      {setup.status === "loading" && (
        <p role="status" className="text-muted-foreground text-sm">
          {t("setup.loading")}
        </p>
      )}
      {setup.status === "failed" && (
        <div className="flex flex-col gap-3">
          <AuthAlert>{t(`errors.${setup.error}`)}</AuthAlert>
          <Link
            href="/admin/sign-in"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("twoFactor.startOver")}
          </Link>
        </div>
      )}
      {setup.status === "ready" && (
        <ol className="flex flex-col gap-6">
          <li className="flex flex-col gap-3">
            <p className="text-sm">{t("setup.step1")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on the server */}
            <img
              src={setup.qrCode}
              alt={t("setup.qrAlt")}
              width={192}
              height={192}
              className="self-center rounded-lg bg-white p-2"
            />
            <p className="text-muted-foreground text-sm">{t("setup.manual")}</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 rounded-lg px-3 py-2 font-mono text-sm break-all">
                {setup.secret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon-touch"
                aria-label={copied ? t("setup.copied") : t("setup.copyKey")}
                onClick={() => copy(setup.secret.replace(/\s/g, ""))}
              >
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </Button>
            </div>
          </li>
          <li>
            <form noValidate onSubmit={submit} className="flex flex-col gap-5">
              <p className="text-sm">{t("setup.step2")}</p>
              <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
              <TextField
                id="setup-code"
                label={t("twoFactor.code")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                className="[&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.3em]"
                error={codeError && t(`errors.${codeError}` as Parameters<typeof t>[0])}
                {...register("code")}
              />
              <AuthSubmit
                isSubmitting={isSubmitting}
                label={t("setup.submit")}
                submittingLabel={t("twoFactor.submitting")}
              />
            </form>
          </li>
        </ol>
      )}
    </>
  );
};
