"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ref } from "react";

import { DONATE_FIELD_IDS } from "@/hooks/use-donate-form";
import type { DonationField } from "@/lib/donation-schema";

type ErrorSummaryProps = {
  ref: Ref<HTMLDivElement>;
  fields: DonationField[];
};

/** Lists every invalid field with a link that moves focus to it. Receives focus on failed submit. */
export const ErrorSummary = ({ ref, fields }: ErrorSummaryProps) => {
  const t = useTranslations("Donate");

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-labelledby="donate-error-summary-title"
      className="border-destructive bg-destructive/5 focus-visible:outline-ring rounded-xl border-2 p-5 focus-visible:outline-3 focus-visible:outline-offset-2 sm:p-6"
    >
      <h2
        id="donate-error-summary-title"
        className="text-destructive flex items-center gap-2 text-lg font-semibold"
      >
        <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
        {t("errorSummaryTitle", { count: fields.length })}
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {fields.map((field) => (
          <li key={field}>
            <a
              href={`#${DONATE_FIELD_IDS[field]}`}
              className="text-destructive inline-flex min-h-11 items-center font-medium underline underline-offset-2 sm:min-h-0 sm:py-1"
            >
              {t(`errors.${field}`)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
