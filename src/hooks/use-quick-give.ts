"use client";

import { useFormatter } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { donationConfig, type Frequency, type FundId } from "@/config/donation";
import { useRouter } from "@/i18n/navigation";
import { parseAmountToCents } from "@/lib/money";
import { useDonationStore } from "@/stores/donation";

export type CustomAmountError = "invalid" | "min" | "max" | null;

/**
 * State and handlers for the home page quick-give bar. Reads and writes the shared donation store
 * (persisted to sessionStorage) so the choice carries over to /donate, and also passes it in the
 * URL so the hand-off works as a shareable deep link.
 */
export const useQuickGive = () => {
  const router = useRouter();
  const format = useFormatter();
  const customInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const { frequency, amountCents, isCustom, fundId, setFrequency, setAmount, setFund } =
    useDonationStore(
      useShallow((state) => ({
        frequency: state.frequency,
        amountCents: state.amountCents,
        isCustom: state.isCustom,
        fundId: state.fundId,
        setFrequency: state.setFrequency,
        setAmount: state.setAmount,
        setFund: state.setFund,
      })),
    );

  useEffect(() => {
    void useDonationStore.persist.rehydrate();
  }, []);

  const parsedDraft = draft ? parseAmountToCents(draft) : null;
  const customError: CustomAmountError = !draft
    ? null
    : parsedDraft === null
      ? "invalid"
      : parsedDraft < donationConfig.minCents
        ? "min"
        : parsedDraft > donationConfig.maxCents
          ? "max"
          : null;

  const customValue =
    draft ??
    (isCustom
      ? format.number(amountCents / 100, { useGrouping: false, maximumFractionDigits: 2 })
      : "");

  const selectFrequency = (next: Frequency) => {
    if (!isCustom) setDraft(null);
    setFrequency(next);
  };

  const selectPreset = (cents: number) => {
    setDraft(null);
    setAmount(cents, false);
  };

  const changeCustom = (value: string) => {
    setDraft(value);
    const cents = parseAmountToCents(value);

    if (!value.trim()) {
      setAmount(donationConfig.defaultCents[frequency], false);
    } else if (
      cents !== null &&
      cents >= donationConfig.minCents &&
      cents <= donationConfig.maxCents
    ) {
      setAmount(cents, true);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (customError) {
      customInputRef.current?.focus();
      return;
    }

    router.push({
      pathname: "/donate",
      query: { amount: String(amountCents / 100), frequency, fund: fundId },
    });
  };

  return {
    frequency,
    amountCents,
    isCustom,
    fundId,
    presets: donationConfig.presetsCents[frequency],
    customValue,
    customError,
    customInputRef,
    selectFrequency,
    selectPreset,
    changeCustom,
    selectFund: (id: FundId) => setFund(id),
    submit,
  };
};
