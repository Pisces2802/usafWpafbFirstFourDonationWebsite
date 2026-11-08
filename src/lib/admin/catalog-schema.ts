import { z } from "zod";

import { FUND_IDS } from "@/config/donation";
import { campaignSlugSchema } from "@/lib/donation-schema";
import { parseAmountToCents } from "@/lib/money";

const MAX_GOAL_CENTS = 100_000_000;

/** "" or a calendar date from a date input ("2026-11-30"). */
const dateField = z.union([z.literal(""), z.iso.date()]);

/** Shared by the campaign form and its server actions. Dates are whole days in UTC. */
export const campaignSchema = z
  .object({
    slug: z.string().trim().toLowerCase().pipe(campaignSlugSchema),
    goal: z
      .string()
      .trim()
      .transform((value, context) => {
        const cents = parseAmountToCents(value);
        if (cents === null || cents < 100 || cents > MAX_GOAL_CENTS) {
          context.addIssue({ code: "custom", message: "goal" });
          return z.NEVER;
        }
        return cents;
      }),
    startsOn: dateField,
    endsOn: dateField,
  })
  .refine((value) => !value.startsOn || !value.endsOn || value.startsOn <= value.endsOn, {
    path: ["endsOn"],
    message: "endsBeforeStart",
  });

export type CampaignInput = z.input<typeof campaignSchema>;
export type CampaignValues = z.output<typeof campaignSchema>;

export const CAMPAIGN_FIELDS = [
  "slug",
  "goal",
  "startsOn",
  "endsOn",
] as const satisfies readonly (keyof CampaignInput)[];

/** Midnight UTC at the start of a date input's day, or null when it's empty. */
export const startOfDay = (date: string) => (date ? new Date(`${date}T00:00:00.000Z`) : null);

/** The last moment of a date input's day in UTC, so a campaign runs through its end date. */
export const endOfDay = (date: string) => (date ? new Date(`${date}T23:59:59.999Z`) : null);

/** A stored timestamp back as a date input value. */
export const toDateInput = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

/** The full fund order, as the Funds page saves it. Every fund appears exactly once. */
export const fundOrderSchema = z
  .array(z.enum(FUND_IDS))
  .length(FUND_IDS.length)
  .refine((ids) => new Set(ids).size === FUND_IDS.length);

/** Reasons a campaign or fund change can be refused, keyed into `Admin.catalog.errors`. */
export const CATALOG_ERRORS = [
  "invalid",
  "slugTaken",
  "notFound",
  "hasGifts",
  "lastFund",
  "noDatabase",
] as const;
export type CatalogError = (typeof CATALOG_ERRORS)[number];

export type CatalogResult = { ok: true } | { ok: false; error: CatalogError };

/** "spring-appeal" → "Spring appeal". Campaigns don't have translated names yet. */
export const campaignName = (slug: string) => {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
