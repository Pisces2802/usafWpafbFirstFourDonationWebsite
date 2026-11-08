"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useLocale, useTranslations } from "next-intl";

import { AmountPicker } from "@/components/donation/amount-picker";
import { CheckoutPanel } from "@/components/donation/checkout-panel";
import { DonationSummary } from "@/components/donation/donation-summary";
import { ErrorSummary } from "@/components/donation/error-summary";
import { FormStep } from "@/components/donation/form-step";
import { FrequencyToggle } from "@/components/donation/frequency-toggle";
import { FundPicker } from "@/components/donation/fund-picker";
import { TextField } from "@/components/donation/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import type { FundId } from "@/config/donation";
import { siteConfig } from "@/config/site";
import { useAvailableFund } from "@/hooks/use-available-fund";
import { DONATE_FIELD_IDS, type TributeType, useDonateForm } from "@/hooks/use-donate-form";
import { useDonationTotals } from "@/hooks/use-donation-totals";
import { useFormatMoney } from "@/hooks/use-format-money";
import type { FeeRates } from "@/lib/fees";
import type { CampaignProgress } from "@/lib/campaign-progress";
import { cn } from "@/lib/utils";

const CampaignProgressBar = ({ progress }: { progress: CampaignProgress }) => {
  const ratio = progress.goalCents > 0 ? progress.raisedCents / progress.goalCents : 0;
  const percent = Math.min(Math.round(ratio * 100), 100);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-muted h-2 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const TRIBUTE_TYPES = ["honour", "memory"] as const satisfies readonly TributeType[];

const checkboxRowClassName =
  "flex min-h-11 cursor-pointer items-start gap-3 py-2 [&_[data-slot=checkbox]]:mt-1";

type DonateFormProps = {
  funds: readonly FundId[];
  feeRates: FeeRates;
  isTaxDeductible: boolean;
  stripePublishableKey: string | null;
  turnstileSiteKey: string | null;
  campaignProgress: CampaignProgress | null;
};

export const DonateForm = ({
  funds,
  feeRates,
  isTaxDeductible,
  stripePublishableKey,
  turnstileSiteKey,
  campaignProgress,
}: DonateFormProps) => {
  const t = useTranslations("Donate");
  const locale = useLocale();
  const formatMoney = useFormatMoney();
  const {
    amount,
    fundId,
    coverFees,
    tribute,
    donor,
    errors,
    hasError,
    isReady,
    status,
    clientSecret,
    errorSummaryRef,
    turnstileRef,
    submit,
    editGift,
    setTurnstileToken,
    selectFund,
    toggleCoverFees,
    setDonor,
    toggleTribute,
    updateTribute,
  } = useDonateForm({
    isCheckoutEnabled: stripePublishableKey !== null,
    requiresTurnstile: turnstileSiteKey !== null,
  });
  useAvailableFund(funds);
  const totals = useDonationTotals(feeRates);
  const { frequency, amountCents, customError, selectFrequency } = amount;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={!isReady}
      className={cn(
        "grid gap-6 transition-opacity duration-300 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-start lg:gap-10",
        !isReady && "opacity-0",
      )}
    >
      {stripePublishableKey && clientSecret ? (
        <CheckoutPanel
          publishableKey={stripePublishableKey}
          clientSecret={clientSecret}
          onEdit={editGift}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          {errors.length > 0 && <ErrorSummary ref={errorSummaryRef} fields={errors} />}

          {campaignProgress && (
            <CampaignProgressBar progress={campaignProgress} />
          )}

          <FormStep id="donate-step-gift" step={1} title={t("stepGift")}>
            <FrequencyToggle value={frequency} onChange={selectFrequency} className="sm:max-w-xs" />
            <AmountPicker amount={amount} inputId={DONATE_FIELD_IDS.amount} />
            <FundPicker funds={funds} value={fundId} onChange={selectFund} />

            <label className={cn(checkboxRowClassName, "border-t pt-6")}>
              <Checkbox checked={coverFees} onCheckedChange={toggleCoverFees} />
              <span>
                {t("coverFees", {
                  frequency: frequency,
                  fee: formatMoney(totals.feeCents),
                  amount: formatMoney(amountCents),
                  orgName: siteConfig.orgName,
                })}
              </span>
            </label>
          </FormStep>

          <FormStep id="donate-step-tribute" step={2} title={t("stepTribute")}>
            <label className={checkboxRowClassName}>
              <Checkbox checked={tribute !== null} onCheckedChange={toggleTribute} />
              <span>{t("tributeToggle")}</span>
            </label>

            {tribute && (
              <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 flex flex-col gap-6 duration-200">
                <fieldset>
                  <legend className="text-muted-foreground mb-2 text-sm font-medium">
                    {t("tributeTypeLegend")}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {TRIBUTE_TYPES.map((type) => (
                      <label
                        key={type}
                        className="border-input bg-background hover:border-primary has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-ring inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 font-semibold transition-colors duration-150 has-focus-visible:outline-3 has-focus-visible:outline-offset-2"
                      >
                        <input
                          type="radio"
                          name="tributeType"
                          value={type}
                          checked={tribute.type === type}
                          onChange={() => updateTribute({ type })}
                          className="sr-only"
                        />
                        {t(`tributeType.${type}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <TextField
                  id={DONATE_FIELD_IDS["tribute.honoreeName"]}
                  label={t("honoreeName")}
                  autoComplete="off"
                  value={tribute.honoreeName}
                  onChange={(event) => updateTribute({ honoreeName: event.target.value })}
                  error={hasError("tribute.honoreeName") && t("errors.tribute.honoreeName")}
                />
                <TextField
                  id={DONATE_FIELD_IDS["tribute.notifyEmail"]}
                  type="email"
                  label={t("notifyEmail")}
                  hint={t("notifyEmailHint")}
                  autoComplete="off"
                  value={tribute.notifyEmail ?? ""}
                  onChange={(event) => updateTribute({ notifyEmail: event.target.value })}
                  error={hasError("tribute.notifyEmail") && t("errors.tribute.notifyEmail")}
                />
              </div>
            )}
          </FormStep>

          <FormStep id="donate-step-details" step={3} title={t("stepDetails")}>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField
                id={DONATE_FIELD_IDS["donor.firstName"]}
                label={t("firstName")}
                autoComplete="given-name"
                value={donor.firstName}
                onChange={(event) => setDonor({ firstName: event.target.value })}
                error={hasError("donor.firstName") && t("errors.donor.firstName")}
              />
              <TextField
                id={DONATE_FIELD_IDS["donor.lastName"]}
                label={t("lastName")}
                autoComplete="family-name"
                value={donor.lastName}
                onChange={(event) => setDonor({ lastName: event.target.value })}
                error={hasError("donor.lastName") && t("errors.donor.lastName")}
              />
            </div>
            <TextField
              id={DONATE_FIELD_IDS["donor.email"]}
              type="email"
              label={t("email")}
              hint={t("emailHint")}
              autoComplete="email"
              spellCheck={false}
              value={donor.email}
              onChange={(event) => setDonor({ email: event.target.value })}
              error={hasError("donor.email") && t("errors.donor.email")}
            />
          </FormStep>
        </div>
      )}

      <DonationSummary
        frequency={frequency}
        fundId={fundId}
        coverFees={coverFees}
        hasAmount={!customError}
        totals={totals}
        isTaxDeductible={isTaxDeductible}
        status={status}
        isCheckoutOpen={clientSecret !== null}
        turnstile={
          turnstileSiteKey && (
            <Turnstile
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
              options={{
                appearance: "interaction-only",
                size: "flexible",
                theme: "dark",
                language: locale,
              }}
              className="mt-6 empty:hidden"
            />
          )
        }
      />
    </form>
  );
};
