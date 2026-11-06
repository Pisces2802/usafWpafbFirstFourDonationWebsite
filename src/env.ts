import { z } from "zod";

const blankToUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const schema = z
  .object({
    NEXT_PUBLIC_SITE_URL: blankToUndefined(z.url().default("http://localhost:3000")),
    NEXT_PUBLIC_TAX_DEDUCTIBLE: blankToUndefined(
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
    ORG_EIN: blankToUndefined(
      z
        .string()
        .regex(/^\d{2}-\d{7}$/, "ORG_EIN must look like 12-3456789")
        .optional(),
    ),
    NEXT_PUBLIC_HERO_VIDEO_BASE_URL: blankToUndefined(
      z
        .union([z.url(), z.string().startsWith("/")])
        .default("/assets")
        .transform((value) => value.replace(/\/+$/, "")),
    ),
  })
  .refine((env) => !env.NEXT_PUBLIC_TAX_DEDUCTIBLE || env.ORG_EIN, {
    message: "ORG_EIN is required when NEXT_PUBLIC_TAX_DEDUCTIBLE=true",
    path: ["ORG_EIN"],
  });

const parsed = schema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_TAX_DEDUCTIBLE: process.env.NEXT_PUBLIC_TAX_DEDUCTIBLE,
  ORG_EIN: process.env.ORG_EIN,
  NEXT_PUBLIC_HERO_VIDEO_BASE_URL: process.env.NEXT_PUBLIC_HERO_VIDEO_BASE_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
