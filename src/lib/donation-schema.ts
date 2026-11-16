import { z } from "@/lib/zod";

import { donationConfig, FREQUENCIES, FUND_IDS } from "@/config/donation";
import { routing } from "@/i18n/routing";

const optionalEmail = z
  .union([z.email(), z.literal("")])
  .optional()
  .transform((value) => value || undefined);

/**
 * Names go into emails sent from the group's address (receipts and tribute notices, which can go
 * to anyone), so they can't carry web addresses, email addresses or markup. Otherwise a $5 gift
 * would buy a spam or phishing email from our domain.
 */
const LINK_LIKE = /:\/\/|www\.|[@<>]|[\p{L}\p{N}]\.\p{L}{2,}/iu;

const personName = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !LINK_LIKE.test(value));

export const campaignSlugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/** Shared by the /donate form and `POST /api/checkout`; the server re-validates and recomputes fees. */
export const donationSchema = z.object({
  frequency: z.enum(FREQUENCIES),
  amountCents: z.int().min(donationConfig.minCents).max(donationConfig.maxCents),
  fundId: z.enum(FUND_IDS),
  coverFees: z.boolean(),
  tribute: z
    .object({
      type: z.enum(["honour", "memory"]),
      honoreeName: personName(100),
      notifyEmail: optionalEmail,
    })
    .nullable(),
  donor: z.object({
    firstName: personName(60),
    lastName: personName(60),
    email: z.email(),
  }),
  campaign: campaignSlugSchema.nullable().optional(),
});

export type DonationInput = z.input<typeof donationSchema>;

/** Fields the donor fills in on /donate, in page order, used to key and order validation errors. */
export const DONATION_FIELDS = [
  "amount",
  "tribute.honoreeName",
  "tribute.notifyEmail",
  "donor.firstName",
  "donor.lastName",
  "donor.email",
] as const;

export type DonationField = (typeof DONATION_FIELDS)[number];

const toField = (path: PropertyKey[]): DonationField | null => {
  const key = path.join(".");
  if (key === "amountCents") return "amount";
  return DONATION_FIELDS.find((field) => field === key) ?? null;
};

/** Validates donation input and returns the invalid fields in page order (empty when valid). */
export const getDonationErrors = (input: DonationInput): DonationField[] => {
  const result = donationSchema.safeParse(input);
  if (result.success) return [];

  const fields = new Set(result.error.issues.map((issue) => toField(issue.path)));
  return DONATION_FIELDS.filter((field) => fields.has(field));
};

/** Body of `POST /api/checkout`. */
export const checkoutRequestSchema = z.object({
  donation: donationSchema,
  locale: z.enum(routing.locales),
  turnstileToken: z.string().max(2048).optional(),
});

export type CheckoutRequest = z.input<typeof checkoutRequestSchema>;

export const CHECKOUT_ERRORS = [
  "invalid",
  "rate_limited",
  "verification_failed",
  "unavailable",
  "failed",
] as const;

export type CheckoutError = (typeof CHECKOUT_ERRORS)[number];
