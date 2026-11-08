"use client";

import { ChevronDown, LockKeyhole, ReceiptText, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { AmountPicker } from "@/components/donation/amount-picker";
import { FrequencyToggle } from "@/components/donation/frequency-toggle";
import { buttonVariants } from "@/components/ui/button";
import { FUND_IDS, isFundId } from "@/config/donation";
import { useFormatMoney } from "@/hooks/use-format-money";
import { useQuickGive } from "@/hooks/use-quick-give";
import { cn } from "@/lib/utils";

export const QuickGiveBar = ({ isTaxDeductible }: { isTaxDeductible: boolean }) => {
  const t = useTranslations("QuickGive");
  const tFunds = useTranslations("Funds");
  const formatMoney = useFormatMoney();
  const { amount, fundId, selectFund, submit } = useQuickGive();

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
          <FrequencyToggle
            value={amount.frequency}
            onChange={amount.selectFrequency}
            className="shrink-0"
          />
          <AmountPicker amount={amount} inputId="quick-give-custom" className="flex-1" />
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
            {amount.customError
              ? t("giveNoAmount")
              : t("give", { frequency: amount.frequency, amount: formatMoney(amount.amountCents) })}
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
