"use client";

import { useTranslations } from "next-intl";

import { TextField } from "@/components/donation/text-field";
import { SelectField, TextareaField } from "@/components/forms/fields";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { FormSent, FormSubmit } from "@/components/forms/form-submit";
import { useContactForm } from "@/hooks/use-contact-form";
import { CONTACT_TOPICS, type ContactInput } from "@/lib/form-schemas";

const FIELD_IDS: Record<keyof ContactInput, string> = {
  name: "contact-name",
  email: "contact-email",
  topic: "contact-topic",
  message: "contact-message",
};

type ContactFormProps = {
  turnstileSiteKey: string | null;
};

export const ContactForm = ({ turnstileSiteKey }: ContactFormProps) => {
  const t = useTranslations("Contact");
  const tForms = useTranslations("Forms");
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
  } = useContactForm({ requiresTurnstile: turnstileSiteKey !== null });

  if (sent) {
    return (
      <FormSent
        title={t("successTitle", { name: sent.name })}
        body={t("successBody", { email: sent.email })}
        onStartOver={startOver}
      />
    );
  }

  const error = (field: keyof ContactInput) =>
    invalidFields.includes(field) ? t(`errors.${field}`) : undefined;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      {invalidFields.length > 0 && (
        <FormErrorSummary
          ref={summaryRef}
          id="contact-errors"
          items={invalidFields.map((field) => ({
            href: `#${FIELD_IDS[field]}`,
            message: t(`errors.${field}`),
          }))}
        />
      )}

      <div className="flex flex-col gap-6">
        <TextField
          id={FIELD_IDS.name}
          label={t("name")}
          autoComplete="name"
          error={error("name")}
          {...register("name")}
        />
        <TextField
          id={FIELD_IDS.email}
          type="email"
          label={t("email")}
          hint={t("emailHint")}
          autoComplete="email"
          spellCheck={false}
          error={error("email")}
          {...register("email")}
        />
      </div>

      <SelectField
        id={FIELD_IDS.topic}
        label={t("topic")}
        error={error("topic")}
        options={CONTACT_TOPICS.map((value) => ({ value, label: tForms(`topics.${value}`) }))}
        {...register("topic")}
      />

      <TextareaField
        id={FIELD_IDS.message}
        label={t("message")}
        rows={6}
        error={error("message")}
        {...register("message")}
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
