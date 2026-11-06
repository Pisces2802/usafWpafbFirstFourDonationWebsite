"use client";

import { LockKeyhole, ReceiptText, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { Frequency, FundId } from "@/config/donation";
import type { CheckoutStatus } from "@/hooks/use-donate-form";
import { useFormatMoney } from "@/hooks/use-format-money";
import { cn } from "@/lib/utils";

type DonationSummaryProps = {
  frequency: Frequency;
  fundId: FundId;
  coverFees: boolean;
  hasAmount: boolean;
  totals: { amountCents: number; feeCents: number; totalCents: number };
  isTaxDeductible: boolean;
  status: CheckoutStatus;
  isCheckoutOpen: boolean;
  turnstile: ReactNode;
};

export const DonationSummary = ({
  frequency,
  fundId,
  coverFees,
  hasAmount,
  totals,
  isTaxDeductible,
  status,
  isCheckoutOpen,
  turnstile,
}: DonationSummaryProps) => {
  const t = useTranslations("Donate");
  const tGive = useTranslations("QuickGive");
  const tFunds = useTranslations("Funds");
  const formatMoney = useFormatMoney();
  const money = (cents: number) => (hasAmount ? formatMoney(cents) : "–");

  return (
    <aside
      aria-labelledby="donate-summary-heading"
      className="surface-night rounded-xl p-5 shadow-xl sm:p-8 lg:sticky lg:top-28"
    >
      <h2 id="donate-summary-heading" className="font-condensed text-2xl sm:text-3xl">
        {t("summaryHeading")}
      </h2>

      <dl className="mt-6 flex flex-col gap-3 tabular-nums">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("summaryFrequency")}</dt>
          <dd className="text-right font-medium">
            {frequency === "monthly" ? tGive("monthly") : tGive("oneTime")}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("summaryFund")}</dt>
          <dd className="text-right font-medium">{tFunds(`${fundId}.name`)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("summaryGift")}</dt>
          <dd className="text-right font-medium">{money(totals.amountCents)}</dd>
        </div>
        {coverFees && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("summaryFees")}</dt>
            <dd className="text-right font-medium">{money(totals.feeCents)}</dd>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-white/15 pt-4">
          <dt className="font-semibold">{t("summaryTotal", { frequency })}</dt>
          <dd className="headline text-right text-4xl">{money(totals.totalCents)}</dd>
        </div>
      </dl>

      {!isCheckoutOpen && (
        <>
          {turnstile}
          <button
            type="submit"
            aria-disabled={status === "submitting" || undefined}
            className={cn(
              buttonVariants({ variant: "donate", size: "touch" }),
              "mt-6 w-full aria-disabled:cursor-progress aria-disabled:opacity-80",
            )}
          >
            {status === "submitting" ? t("submitting") : t("submit")}
          </button>
        </>
      )}

      <div aria-live="polite">
        {status !== "idle" && status !== "submitting" && (
          <p className="mt-4 rounded-lg bg-white/10 p-4 text-sm">{t(`checkoutStatus.${status}`)}</p>
        )}
      </div>

      <ul
        aria-label={tGive("notesLabel")}
        className="text-muted-foreground mt-6 flex flex-col gap-2 text-sm"
      >
        <li className="inline-flex items-center gap-2">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
          {t("paymentNote")}
        </li>
        {frequency === "monthly" && (
          <li className="inline-flex items-center gap-2">
            <RefreshCcw aria-hidden="true" className="size-4 shrink-0" />
            {tGive("cancelAnytime")}
          </li>
        )}
        {isTaxDeductible && (
          <li className="inline-flex items-center gap-2">
            <ReceiptText aria-hidden="true" className="size-4 shrink-0" />
            {tGive("taxDeductible")}
          </li>
        )}
      </ul>
    </aside>
  );
};
