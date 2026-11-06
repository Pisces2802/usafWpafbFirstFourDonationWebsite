"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useLocale } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { donationConfig, isFrequency, isFundId } from "@/config/donation";
import { useAmountChoice } from "@/hooks/use-amount-choice";
import {
  campaignSlugSchema,
  CHECKOUT_ERRORS,
  type CheckoutError,
  type CheckoutRequest,
  type DonationField,
  getDonationErrors,
} from "@/lib/donation-schema";
import { parseAmountToCents } from "@/lib/money";
import { useDonationStore } from "@/stores/donation";

export type TributeType = "honour" | "memory";

export type CheckoutStatus = "idle" | "submitting" | "verifying" | CheckoutError;

const isCheckoutError = (value: unknown): value is CheckoutError =>
  CHECKOUT_ERRORS.includes(value as CheckoutError);

/** Asks the server for an embedded Checkout Session; returns its client secret or an error code. */
const requestCheckout = async (body: CheckoutRequest) => {
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { clientSecret?: string; error?: unknown };

    if (response.ok && data.clientSecret) return { clientSecret: data.clientSecret };
    return { error: isCheckoutError(data.error) ? data.error : ("failed" as const) };
  } catch {
    return { error: "failed" as const };
  }
};

/** Element id for each field, so the error summary can link to it. */
export const DONATE_FIELD_IDS: Record<DonationField, string> = {
  amount: "donate-amount",
  "tribute.honoreeName": "donate-honoree-name",
  "tribute.notifyEmail": "donate-notify-email",
  "donor.firstName": "donate-first-name",
  "donor.lastName": "donate-last-name",
  "donor.email": "donate-email",
};

/**
 * Applies a campaign deep link (`?amount=100&frequency=monthly&fund=emergency&campaign=giving-day`) over whatever the
 * donor chose earlier this visit, then strips the query so a refresh doesn't undo later changes.
 */
const applyDeepLink = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.size) return;

  const { setFrequency, setAmount, setFund, setCampaign } = useDonationStore.getState();
  const frequency = params.get("frequency");
  const fund = params.get("fund");
  const campaign = campaignSlugSchema.safeParse(params.get("campaign"));
  const cents = parseAmountToCents(params.get("amount") ?? "");

  if (isFrequency(frequency)) setFrequency(frequency);
  if (isFundId(fund)) setFund(fund);
  if (campaign.success) setCampaign(campaign.data);
  if (cents !== null && cents >= donationConfig.minCents && cents <= donationConfig.maxCents) {
    const presets: readonly number[] =
      donationConfig.presetsCents[useDonationStore.getState().frequency];
    setAmount(cents, !presets.includes(cents));
  }

  window.history.replaceState(window.history.state, "", window.location.pathname);
};

/**
 * State and handlers for the /donate form. The donation store is the source of truth; this hook
 * restores it from sessionStorage, applies deep links, and validates with the shared schema.
 * Errors appear only after the first submit, then update live as the donor fixes them. A valid
 * submit exchanges the gift (and a Turnstile token, when required) for an embedded Checkout.
 */
export const useDonateForm = ({
  isCheckoutEnabled,
  requiresTurnstile,
}: {
  isCheckoutEnabled: boolean;
  requiresTurnstile: boolean;
}) => {
  const locale = useLocale();
  const amount = useAmountChoice();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [isReady, setIsReady] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const {
    fundId,
    coverFees,
    tribute,
    donor,
    campaign,
    setFund,
    toggleCoverFees,
    setTribute,
    setDonor,
  } = useDonationStore(
    useShallow((state) => ({
      fundId: state.fundId,
      campaign: state.campaign,
      coverFees: state.coverFees,
      tribute: state.tribute,
      donor: state.donor,
      setFund: state.setFund,
      toggleCoverFees: state.toggleCoverFees,
      setTribute: state.setTribute,
      setDonor: state.setDonor,
    })),
  );

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      await useDonationStore.persist.rehydrate();
      if (isCancelled) return;
      applyDeepLink();
      setIsReady(true);
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const donation = {
    frequency: amount.frequency,
    amountCents: amount.amountCents,
    fundId,
    coverFees,
    tribute,
    donor,
    campaign,
  };
  const schemaErrors = getDonationErrors(donation);
  const allErrors: DonationField[] = amount.customError
    ? ["amount", ...schemaErrors.filter((field) => field !== "amount")]
    : schemaErrors;
  const errors = submitCount > 0 ? allErrors : [];

  useEffect(() => {
    if (submitCount > 0) errorSummaryRef.current?.focus();
  }, [submitCount]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    if (allErrors.length > 0) {
      setStatus("idle");
      setSubmitCount((count) => count + 1);
      return;
    }

    if (!isCheckoutEnabled) {
      setStatus("unavailable");
      return;
    }

    if (requiresTurnstile && !turnstileToken) {
      setStatus("verifying");
      return;
    }

    setStatus("submitting");
    const result = await requestCheckout({
      donation,
      locale: locale as CheckoutRequest["locale"],
      turnstileToken: turnstileToken ?? undefined,
    });

    if (requiresTurnstile) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }

    if (result.clientSecret) {
      setClientSecret(result.clientSecret);
      setStatus("idle");
    } else {
      setStatus(result.error ?? "failed");
    }
  };

  const hasError = (field: DonationField) => errors.includes(field);

  return {
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
    editGift: () => setClientSecret(null),
    setTurnstileToken,
    selectFund: setFund,
    toggleCoverFees,
    setDonor,
    toggleTribute: (isOn: boolean) =>
      setTribute(isOn ? { type: "honour", honoreeName: "", notifyEmail: "" } : null),
    updateTribute: (patch: Partial<NonNullable<typeof tribute>>) =>
      tribute && setTribute({ ...tribute, ...patch }),
  };
};
