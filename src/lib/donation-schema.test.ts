import { describe, expect, it } from "vitest";

import { donationConfig } from "@/config/donation";
import {
  checkoutRequestSchema,
  type DonationInput,
  donationSchema,
  getDonationErrors,
} from "@/lib/donation-schema";

const valid: DonationInput = {
  frequency: "one_time",
  amountCents: 5000,
  fundId: "general",
  coverFees: false,
  tribute: null,
  donor: { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com" },
};

describe("donationSchema", () => {
  it("accepts a complete gift", () => {
    expect(donationSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces the minimum and maximum, inclusive, in whole cents", () => {
    const amount = (amountCents: number) =>
      donationSchema.safeParse({ ...valid, amountCents }).success;

    expect(amount(donationConfig.minCents)).toBe(true);
    expect(amount(donationConfig.minCents - 1)).toBe(false);
    expect(amount(donationConfig.maxCents)).toBe(true);
    expect(amount(donationConfig.maxCents + 1)).toBe(false);
    expect(amount(5000.5)).toBe(false);
  });

  it("rejects unknown funds and frequencies", () => {
    expect(donationSchema.safeParse({ ...valid, fundId: "travel" }).success).toBe(false);
    expect(donationSchema.safeParse({ ...valid, frequency: "yearly" }).success).toBe(false);
  });

  it("trims names and treats an empty tribute email as none", () => {
    const result = donationSchema.parse({
      ...valid,
      donor: { ...valid.donor, firstName: "  Ana  " },
      tribute: { type: "memory", honoreeName: " Sgt. Lee ", notifyEmail: "" },
    });

    expect(result.donor.firstName).toBe("Ana");
    expect(result.tribute).toEqual({ type: "memory", honoreeName: "Sgt. Lee" });
  });

  it("only accepts lowercase campaign slugs", () => {
    const campaign = (value: string | null) =>
      donationSchema.safeParse({ ...valid, campaign: value }).success;

    expect(campaign("spring-2027")).toBe(true);
    expect(campaign(null)).toBe(true);
    expect(campaign("Spring 2027")).toBe(false);
    expect(campaign("a".repeat(65))).toBe(false);
  });
});

describe("getDonationErrors", () => {
  it("is empty for a valid gift", () => {
    expect(getDonationErrors(valid)).toEqual([]);
  });

  it("returns the invalid fields in page order, whatever order zod reports them", () => {
    const errors = getDonationErrors({
      ...valid,
      amountCents: 1,
      tribute: { type: "honour", honoreeName: "   ", notifyEmail: "not-an-email" },
      donor: { firstName: "", lastName: "Ruiz", email: "nope" },
    });

    expect(errors).toEqual([
      "amount",
      "tribute.honoreeName",
      "tribute.notifyEmail",
      "donor.firstName",
      "donor.email",
    ]);
  });

  it("ignores problems with fields the donor can't fix on the page", () => {
    expect(getDonationErrors({ ...valid, campaign: "BAD SLUG" })).toEqual([]);
  });
});

describe("checkoutRequestSchema", () => {
  it("only accepts supported locales", () => {
    expect(checkoutRequestSchema.safeParse({ donation: valid, locale: "fr" }).success).toBe(true);
    expect(checkoutRequestSchema.safeParse({ donation: valid, locale: "de" }).success).toBe(false);
  });
});
