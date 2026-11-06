"use client";

import { useTranslations } from "next-intl";

import type { AmountChoice } from "@/hooks/use-amount-choice";
import { useAmountErrorMessage } from "@/hooks/use-amount-error-message";
import { useFormatMoney } from "@/hooks/use-format-money";
import { cn } from "@/lib/utils";

const chipClassName =
  "relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-4 text-base font-semibold tabular-nums transition-[background-color,border-color,color,scale] duration-150 select-none hover:border-primary active:scale-[0.97] has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

type AmountPickerProps = {
  amount: AmountChoice;
  inputId: string;
  className?: string;
};

export const AmountPicker = ({ amount, inputId, className }: AmountPickerProps) => {
  const t = useTranslations("QuickGive");
  const formatMoney = useFormatMoney();
  const {
    frequency,
    amountCents,
    isCustom,
    presets,
    customValue,
    customError,
    customInputRef,
    selectPreset,
    changeCustom,
  } = amount;
  const errorId = `${inputId}-error`;
  const errorMessage = useAmountErrorMessage(customError);

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="text-muted-foreground mb-2 text-sm font-medium">
        {t("amountLegend")}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {presets.map((cents) => (
          <label key={`${frequency}-${cents}`} className={chipClassName}>
            <input
              type="radio"
              name="amount"
              value={cents}
              checked={!isCustom && amountCents === cents}
              onChange={() => selectPreset(cents)}
              className="sr-only"
            />
            {formatMoney(cents)}
          </label>
        ))}
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={inputId} className="sr-only">
            {t("customLabel")}
          </label>
          <input
            ref={customInputRef}
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("customPlaceholder")}
            value={customValue}
            onChange={(event) => changeCustom(event.target.value)}
            aria-invalid={customError ? true : undefined}
            aria-describedby={customError ? errorId : undefined}
            className={cn(
              "border-input bg-background placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25 min-h-11 w-full scroll-mt-32 rounded-lg border px-4 text-base font-semibold tabular-nums transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3",
              isCustom && !customError && "border-primary",
              customError && "border-destructive focus-visible:ring-destructive/25",
            )}
          />
        </div>
      </div>
      <p id={errorId} aria-live="polite" className="text-destructive mt-2 min-h-5 text-sm">
        {errorMessage}
      </p>
    </fieldset>
  );
};
