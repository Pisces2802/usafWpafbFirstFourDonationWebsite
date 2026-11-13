"use client";

import { useTranslations } from "next-intl";

import { TextField } from "@/components/donation/text-field";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { FormSent, FormSubmit } from "@/components/forms/form-submit";
import { useManageGivingForm } from "@/hooks/use-manage-giving-form";
import { MANAGE_LINK_MINUTES } from "@/lib/form-schemas";

const EMAIL_ID = "manage-giving-email";

type ManageGivingFormProps = {
  turnstileSiteKey: string | null;
};

export const ManageGivingForm = ({ turnstileSiteKey }: ManageGivingFormProps) => {
  const t = useTranslations("ManageGiving");
  const {
    register,
    submit,
    invalidFields,
    summaryRef,
    status,
    sent,
    startOver,
    turnstileRef,
    setTurnstileToken,
    linkProblem,
  } = useManageGivingForm({ requiresTurnstile: turnstileSiteKey !== null });

  if (sent) {
    return (
      <FormSent
        title={t("successTitle")}
        body={t("successBody", { email: sent.email, minutes: MANAGE_LINK_MINUTES })}
        onStartOver={startOver}
      />
    );
  }

  const emailError = invalidFields.includes("email") ? t("errors.email") : undefined;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      {linkProblem && (
        <p role="status" className="border-primary border-l-4 pl-4 text-lg">
          {t(linkProblem === "expired" ? "linkExpired" : "linkFailed")}
        </p>
      )}

      {emailError && (
        <FormErrorSummary
          ref={summaryRef}
          id="manage-giving-errors"
          items={[{ href: `#${EMAIL_ID}`, message: emailError }]}
        />
      )}

      <TextField
        id={EMAIL_ID}
        type="email"
        label={t("email")}
        hint={t("emailHint")}
        autoComplete="email"
        spellCheck={false}
        error={emailError}
        {...register("email")}
      />

      <FormSubmit
        label={t("submit")}
        status={status}
        turnstileSiteKey={turnstileSiteKey}
        turnstileRef={turnstileRef}
        onTurnstileToken={setTurnstileToken}
      />
    </form>
  );
};
