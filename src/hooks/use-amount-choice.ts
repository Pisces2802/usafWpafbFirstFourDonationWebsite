"use client";

import { useFormatter } from "next-intl";
import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { donationConfig, type Frequency } from "@/config/donation";
import { parseAmountToCents } from "@/lib/money";
import { useDonationStore } from "@/stores/donation";

export type CustomAmountError = "invalid" | "min" | "max" | null;

/**
 * Frequency, preset and custom-amount state shared by the quick-give bar and /donate. Valid custom
 * amounts go straight to the donation store; the raw text stays local so the donor can keep typing
 * ("50," in French) without the field being reformatted under them.
 */
export const useAmountChoice = () => {
  const format = useFormatter();
  const customInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const { frequency, amountCents, isCustom, setFrequency, setAmount } = useDonationStore(
    useShallow((state) => ({
      frequency: state.frequency,
      amountCents: state.amountCents,
      isCustom: state.isCustom,
      setFrequency: state.setFrequency,
      setAmount: state.setAmount,
    })),
  );

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

  return {
    frequency,
    amountCents,
    isCustom,
    presets: donationConfig.presetsCents[frequency],
    customValue,
    customError,
    customInputRef,
    selectFrequency,
    selectPreset,
    changeCustom,
  };
};

export type AmountChoice = ReturnType<typeof useAmountChoice>;
