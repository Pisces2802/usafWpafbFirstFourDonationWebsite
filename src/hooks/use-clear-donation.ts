"use client";

import { useEffect } from "react";

import { useDonationStore } from "@/stores/donation";

/** Clears the saved gift once it's paid, so the next visit to /donate starts fresh. */
export const useClearDonation = () => {
  useEffect(() => {
    useDonationStore.getState().reset();
    useDonationStore.persist.clearStorage();
  }, []);
};
