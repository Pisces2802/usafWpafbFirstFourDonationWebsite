"use client";

import { type FormEvent, useEffect } from "react";

import { useAmountChoice } from "@/hooks/use-amount-choice";
import { useRouter } from "@/i18n/navigation";
import { useDonationStore } from "@/stores/donation";

/**
 * State and handlers for the home page quick-give bar. Reads and writes the shared donation store
 * (persisted to sessionStorage) so the choice carries over to /donate, and also passes it in the
 * URL so the hand-off works as a shareable deep link.
 */
export const useQuickGive = () => {
  const router = useRouter();
  const amount = useAmountChoice();
  const fundId = useDonationStore((state) => state.fundId);
  const setFund = useDonationStore((state) => state.setFund);

  useEffect(() => {
    void useDonationStore.persist.rehydrate();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (amount.customError) {
      amount.customInputRef.current?.focus();
      return;
    }

    router.push({
      pathname: "/donate",
      query: {
        amount: String(amount.amountCents / 100),
        frequency: amount.frequency,
        fund: fundId,
      },
    });
  };

  return { amount, fundId, selectFund: setFund, submit };
};
