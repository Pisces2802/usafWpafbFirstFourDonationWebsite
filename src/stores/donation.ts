import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { donationConfig, type Frequency, type FundId } from "@/config/donation";

type Tribute = {
  type: "honour" | "memory";
  honoreeName: string;
  notifyEmail?: string;
} | null;

type Donor = { firstName: string; lastName: string; email: string };

export type DonationState = {
  frequency: Frequency;
  amountCents: number;
  isCustom: boolean;
  fundId: FundId;
  coverFees: boolean;
  tribute: Tribute;
  donor: Donor;
  setFrequency: (f: Frequency) => void;
  setAmount: (cents: number, isCustom?: boolean) => void;
  setFund: (id: FundId) => void;
  toggleCoverFees: () => void;
  setTribute: (t: Tribute) => void;
  setDonor: (d: Partial<Donor>) => void;
  reset: () => void;
};

const initialState = {
  frequency: "one_time" as Frequency,
  amountCents: donationConfig.defaultCents.one_time,
  isCustom: false,
  fundId: donationConfig.defaultFundId as FundId,
  coverFees: false,
  tribute: null as Tribute,
  donor: { firstName: "", lastName: "", email: "" },
};

export const useDonationStore = create<DonationState>()(
  persist(
    (set) => ({
      ...initialState,
      setFrequency: (frequency) =>
        set((state) =>
          state.isCustom
            ? { frequency }
            : { frequency, amountCents: donationConfig.defaultCents[frequency] },
        ),
      setAmount: (amountCents, isCustom = false) => set({ amountCents, isCustom }),
      setFund: (fundId) => set({ fundId }),
      toggleCoverFees: () => set((state) => ({ coverFees: !state.coverFees })),
      setTribute: (tribute) => set({ tribute }),
      setDonor: (donor) => set((state) => ({ donor: { ...state.donor, ...donor } })),
      reset: () => set(initialState),
    }),
    {
      name: "donation",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: ({ frequency, amountCents, isCustom, fundId, coverFees, tribute, donor }) => ({
        frequency,
        amountCents,
        isCustom,
        fundId,
        coverFees,
        tribute,
        donor,
      }),
    },
  ),
);
