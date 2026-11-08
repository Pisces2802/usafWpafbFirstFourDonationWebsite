"use client";

import { useEffect } from "react";

import type { FundId } from "@/config/donation";
import { useDonationStore } from "@/stores/donation";

/**
 * Keeps the chosen fund on the list donors can pick from. If it isn't (the default or a deep link
 * names a fund that's been hidden, or one picked on an earlier visit), the first fund is chosen.
 */
export const useAvailableFund = (funds: readonly FundId[]) => {
  const fundId = useDonationStore((state) => state.fundId);
  const setFund = useDonationStore((state) => state.setFund);
  const fallback = funds[0];

  useEffect(() => {
    if (fallback && !funds.includes(fundId)) setFund(fallback);
  }, [funds, fundId, fallback, setFund]);
};
