"use client";

import { ChevronDown, LockKeyhole, ReceiptText, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { donationConfig, FREQUENCIES, FUND_IDS, isFundId } from "@/config/donation";
import { useFormatMoney } from "@/hooks/use-format-money";
import { useQuickGive } from "@/hooks/use-quick-give";
import { cn } from "@/lib/utils";

const chipClassName =
  "relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-4 text-base font-semibold tabular-nums transition-[background-color,border-color,color,scale] duration-150 select-none hover:border-primary active:scale-[0.97] has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

export const QuickGiveBar = ({ isTaxDeductible }: { isTaxDeductible: boolean }) => {
  const t = useTranslations("QuickGive");
  const tFunds = useTranslations("Funds");
  const formatMoney = useFormatMoney();
  const {
    frequency,
    amountCents,
    isCustom,
    fundId,
    presets,
    customValue,
    customError,
    customInputRef,
    selectFrequency,
    selectPreset,
    changeCustom,
    selectFund,
    submit,
  } = useQuickGive();

  const errorMessage =
    customError === "min"
      ? t("errorMin", { min: formatMoney(donationConfig.minCents) })
      : customError === "max"
        ? t("errorMax", { max: formatMoney(donationConfig.maxCents) })
        : customError === "invalid"
          ? t("errorInvalid")
          : null;

  return (
    <section
      aria-labelledby="quick-give-heading"
      className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8 md:-mt-12 md:pt-0"
    >
      <form
        onSubmit={submit}
        noValidate
        className="bg-card text-card-foreground ring-foreground/10 rounded-xl p-4 shadow-xl ring-1 sm:p-6"
      >
        <h2 id="quick-give-heading" className="sr-only">
          {t("heading")}
        </h2>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:gap-8">
          <fieldset className="shrink-0">
            <legend className="text-muted-foreground mb-2 text-sm font-medium">
              {t("frequencyLegend")}
            </legend>
            <div className="bg-muted relative grid grid-cols-2 rounded-lg p-1">
              <span
                aria-hidden="true"
                className={cn(
                  "bg-card absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out",
                  frequency === "monthly" && "translate-x-full",
                )}
              />
              {FREQUENCIES.map((value) => (
                <label
                  key={value}
                  className="has-focus-visible:outline-ring has-checked:text-foreground has-[:not(:checked)]:text-muted-foreground relative z-10 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors has-focus-visible:outline-3"
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={value}
                    checked={frequency === value}
                    onChange={() => selectFrequency(value)}
                    className="sr-only"
                  />
                  {value === "monthly" ? t("monthly") : t("oneTime")}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="min-w-0 flex-1">
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
                <label htmlFor="quick-give-custom" className="sr-only">
                  {t("customLabel")}
                </label>
                <input
                  ref={customInputRef}
                  id="quick-give-custom"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t("customPlaceholder")}
                  value={customValue}
                  onChange={(event) => changeCustom(event.target.value)}
                  aria-invalid={customError ? true : undefined}
                  aria-describedby={customError ? "quick-give-custom-error" : undefined}
                  className={cn(
                    "border-input bg-background placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25 min-h-11 w-full rounded-lg border px-4 text-base font-semibold tabular-nums transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3",
                    isCustom && !customError && "border-primary",
                    customError && "border-destructive focus-visible:ring-destructive/25",
                  )}
                />
              </div>
            </div>
            <p
              id="quick-give-custom-error"
              aria-live="polite"
              className="text-destructive mt-2 min-h-5 text-sm"
            >
              {errorMessage}
            </p>
          </fieldset>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:max-w-sm sm:flex-1">
            <label
              htmlFor="quick-give-fund"
              className="text-muted-foreground mb-2 block text-sm font-medium"
            >
              {t("fundLabel")}
            </label>
            <div className="relative">
              <select
                id="quick-give-fund"
                name="fund"
                value={fundId}
                onChange={(event) => isFundId(event.target.value) && selectFund(event.target.value)}
                className="border-input bg-background focus-visible:border-primary focus-visible:ring-primary/25 min-h-11 w-full cursor-pointer appearance-none rounded-lg border py-2 pr-10 pl-4 text-base transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3"
              >
                {FUND_IDS.map((id) => (
                  <option key={id} value={id}>
                    {tFunds(`${id}.name`)}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
              />
            </div>
          </div>

          <button
            type="submit"
            className={cn(
              buttonVariants({ variant: "donate", size: "touch" }),
              "min-w-48 tabular-nums",
            )}
          >
            {customError
              ? t("giveNoAmount")
              : t("give", { frequency, amount: formatMoney(amountCents) })}
          </button>
        </div>

        <ul
          aria-label={t("notesLabel")}
          className="text-muted-foreground mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm sm:justify-end"
        >
          <li className="inline-flex items-center gap-1.5">
            <LockKeyhole aria-hidden="true" className="size-4" />
            {t("secureCheckout")}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <RefreshCcw aria-hidden="true" className="size-4" />
            {t("cancelAnytime")}
          </li>
          {isTaxDeductible && (
            <li className="inline-flex items-center gap-1.5">
              <ReceiptText aria-hidden="true" className="size-4" />
              {t("taxDeductible")}
            </li>
          )}
        </ul>
      </form>
    </section>
  );
};
