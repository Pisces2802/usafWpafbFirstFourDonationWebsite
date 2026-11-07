"use client";

import { useTranslations } from "next-intl";

import { TextField } from "@/components/donation/text-field";
import { ChoiceField, choiceId, OptionalLabel, TextareaField } from "@/components/forms/fields";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { FormSent, FormSubmit } from "@/components/forms/form-submit";
import { useVolunteerForm } from "@/hooks/use-volunteer-form";
import {
  VOLUNTEER_AFFILIATIONS,
  VOLUNTEER_INTERESTS,
  type VolunteerInput,
} from "@/lib/form-schemas";

const FIELD_IDS: Record<keyof VolunteerInput, string> = {
  name: "volunteer-name",
  email: "volunteer-email",
  phone: "volunteer-phone",
  affiliation: choiceId("affiliation", VOLUNTEER_AFFILIATIONS[0]),
  interests: choiceId("interests", VOLUNTEER_INTERESTS[0]),
  availability: "volunteer-availability",
};

type VolunteerFormProps = {
  turnstileSiteKey: string | null;
};

export const VolunteerForm = ({ turnstileSiteKey }: VolunteerFormProps) => {
  const t = useTranslations("Volunteer");
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
  } = useVolunteerForm({ requiresTurnstile: turnstileSiteKey !== null });

  if (sent) {
    return (
      <FormSent
        title={t("successTitle", { name: sent.name })}
        body={t("successBody", { email: sent.email })}
        onStartOver={startOver}
      />
    );
  }

  const error = (field: keyof VolunteerInput) =>
    invalidFields.includes(field) ? t(`errors.${field}`) : undefined;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      {invalidFields.length > 0 && (
        <FormErrorSummary
          ref={summaryRef}
          id="volunteer-errors"
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
        <TextField
          id={FIELD_IDS.phone}
          type="tel"
          label={<OptionalLabel>{t("phone")}</OptionalLabel>}
          autoComplete="tel"
          error={error("phone")}
          {...register("phone")}
        />
      </div>

      <ChoiceField
        name="affiliation"
        type="radio"
        legend={t("affiliationLegend")}
        error={error("affiliation")}
        options={VOLUNTEER_AFFILIATIONS.map((value) => ({
          value,
          label: tForms(`affiliations.${value}`),
        }))}
        inputProps={register("affiliation")}
      />

      <ChoiceField
        name="interests"
        type="checkbox"
        legend={t("interestsLegend")}
        hint={t("interestsHint")}
        error={error("interests")}
        options={VOLUNTEER_INTERESTS.map((value) => ({
          value,
          label: tForms(`interests.${value}`),
        }))}
        inputProps={register("interests")}
      />

      <TextareaField
        id={FIELD_IDS.availability}
        label={<OptionalLabel>{t("availability")}</OptionalLabel>}
        hint={t("availabilityHint")}
        rows={3}
        error={error("availability")}
        {...register("availability")}
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
