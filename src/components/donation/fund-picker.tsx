"use client";

import { useTranslations } from "next-intl";

import type { FundId } from "@/config/donation";

type FundPickerProps = {
  /** The funds donors can pick, in order. */
  funds: readonly FundId[];
  value: FundId;
  onChange: (value: FundId) => void;
};

export const FundPicker = ({ funds, value, onChange }: FundPickerProps) => {
  const t = useTranslations("Funds");
  const tDonate = useTranslations("Donate");

  return (
    <fieldset>
      <legend className="text-muted-foreground mb-2 text-sm font-medium">
        {tDonate("fundLegend")}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {funds.map((id) => (
          <label
            key={id}
            className="border-input bg-background hover:border-primary has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:outline-ring has-checked:ring-primary flex cursor-pointer gap-3 rounded-lg border p-4 transition-[background-color,border-color] duration-150 has-checked:ring-1 has-focus-visible:outline-3 has-focus-visible:outline-offset-2"
          >
            <input
              type="radio"
              name="fund"
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
              aria-describedby={`fund-${id}-description`}
              className="accent-primary mt-1 size-4 shrink-0"
            />
            <span className="flex flex-col gap-1">
              <span className="font-semibold">{t(`${id}.name`)}</span>
              <span id={`fund-${id}-description`} className="text-muted-foreground text-sm">
                {t(`${id}.description`)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
