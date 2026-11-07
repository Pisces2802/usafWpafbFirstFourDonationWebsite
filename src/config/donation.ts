export const FREQUENCIES = ["one_time", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FUND_IDS = ["general", "morale", "development", "community"] as const;
export type FundId = (typeof FUND_IDS)[number];

/** Placeholder presets and fund list from the handoff; confirm both with the group before launch. */
export const donationConfig = {
  presetsCents: {
    one_time: [2500, 5000, 10000, 25000],
    monthly: [1000, 2500, 5000, 10000],
  },
  defaultCents: {
    one_time: 10000,
    monthly: 2500,
  },
  minCents: 500,
  maxCents: 2_500_000,
  defaultFundId: "general",
} as const satisfies {
  presetsCents: Record<Frequency, readonly number[]>;
  defaultCents: Record<Frequency, number>;
  minCents: number;
  maxCents: number;
  defaultFundId: FundId;
};

export const isFrequency = (value: unknown): value is Frequency =>
  FREQUENCIES.includes(value as Frequency);

export const isFundId = (value: unknown): value is FundId => FUND_IDS.includes(value as FundId);
