"use client";

import { useShallow } from "zustand/react/shallow";

import { type FeeRates, grossUpCents } from "@/lib/fees";
import { useDonationStore } from "@/stores/donation";

/**
 * Derived totals for the current gift: the fee the donor would add to cover card processing, and
 * what they'll be charged. Never stored; the server recomputes both at checkout.
 */
export const useDonationTotals = (rates: FeeRates) => {
  const { amountCents, coverFees } = useDonationStore(
    useShallow((state) => ({ amountCents: state.amountCents, coverFees: state.coverFees })),
  );
  const { feeCents } = grossUpCents(amountCents, rates);

  return {
    amountCents,
    feeCents,
    totalCents: coverFees ? amountCents + feeCents : amountCents,
  };
};
