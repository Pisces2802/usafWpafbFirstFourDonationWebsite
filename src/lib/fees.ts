export type FeeRates = {
  /** Card processor's percentage fee as a fraction, e.g. 0.029 for 2.9%. */
  pct: number;
  /** Card processor's fixed fee per charge, in cents. */
  fixedCents: number;
};

/**
 * Grosses up a gift so the organisation nets `amountCents` after card fees:
 * `total = (amount + fixed) / (1 - pct)`, rounded up to the cent. Returns the total and the added fee.
 */
export const grossUpCents = (amountCents: number, { pct, fixedCents }: FeeRates) => {
  const totalCents = Math.ceil((amountCents + fixedCents) / (1 - pct) - 1e-9);
  return { totalCents, feeCents: totalCents - amountCents };
};
