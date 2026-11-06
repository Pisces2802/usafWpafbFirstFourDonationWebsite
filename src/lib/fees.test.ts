import { describe, expect, it } from "vitest";

import { grossUpCents } from "@/lib/fees";

const rates = { pct: 0.029, fixedCents: 30 };

describe("grossUpCents", () => {
  it.each([
    [500, 546],
    [2500, 2606],
    [7500, 7755],
    [10000, 10330],
    [2_500_000, 2_574_697],
  ])("grosses %i cents up to %i", (amount, total) => {
    expect(grossUpCents(amount, rates).totalCents).toBe(total);
  });

  it("always nets at least the gift after fees", () => {
    for (let amount = 500; amount <= 100_000; amount += 137) {
      const { totalCents, feeCents } = grossUpCents(amount, rates);
      expect(totalCents - feeCents).toBe(amount);
      expect(totalCents * (1 - rates.pct) - rates.fixedCents).toBeGreaterThanOrEqual(amount);
    }
  });
});
