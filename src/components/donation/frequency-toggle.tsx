"use client";

import { useTranslations } from "next-intl";

import { FREQUENCIES, type Frequency } from "@/config/donation";
import { cn } from "@/lib/utils";

type FrequencyToggleProps = {
  value: Frequency;
  onChange: (value: Frequency) => void;
  className?: string;
};

export const FrequencyToggle = ({ value, onChange, className }: FrequencyToggleProps) => {
  const t = useTranslations("QuickGive");

  return (
    <fieldset className={className}>
      <legend className="text-muted-foreground mb-2 text-sm font-medium">
        {t("frequencyLegend")}
      </legend>
      <div className="bg-muted relative grid grid-cols-2 rounded-lg p-1">
        <span
          aria-hidden="true"
          className={cn(
            "bg-card absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out",
            value === "monthly" && "translate-x-full",
          )}
        />
        {FREQUENCIES.map((option) => (
          <label
            key={option}
            className="has-focus-visible:outline-ring has-checked:text-foreground has-[:not(:checked)]:text-muted-foreground relative z-10 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors has-focus-visible:outline-3"
          >
            <input
              type="radio"
              name="frequency"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option === "monthly" ? t("monthly") : t("oneTime")}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
