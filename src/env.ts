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
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: blankToUndefined(
      z.string().startsWith("pk_", "must start with pk_").optional(),
    ),
    STRIPE_SECRET_KEY: blankToUndefined(
      z
        .string()
        .regex(/^(sk|rk)_/, "must start with sk_ or rk_")
        .optional(),
    ),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: blankToUndefined(z.string().optional()),
    TURNSTILE_SECRET_KEY: blankToUndefined(z.string().optional()),
    STRIPE_WEBHOOK_SECRET: blankToUndefined(
      z.string().startsWith("whsec_", "must start with whsec_").optional(),
    ),
    DATABASE_URL: blankToUndefined(
      z
        .string()
        .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string")
        .optional(),
    ),
    RESEND_API_KEY: blankToUndefined(
      z.string().startsWith("re_", "must start with re_").optional(),
    ),
    EMAIL_FROM: blankToUndefined(z.string().optional()),
    ORG_NOTIFY_EMAIL: blankToUndefined(z.email().optional()),
    STRIPE_PCT_FEE: blankToUndefined(z.coerce.number().min(0).max(0.2).default(0.029)),
    STRIPE_FIXED_FEE_CENTS: blankToUndefined(z.coerce.number().int().min(0).max(500).default(30)),
  })
  .refine((env) => !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY === !env.TURNSTILE_SECRET_KEY, {
    message: "Set both Turnstile keys or neither",
    path: ["TURNSTILE_SECRET_KEY"],
  })
  .refine((env) => !env.RESEND_API_KEY || env.EMAIL_FROM, {
    message: "EMAIL_FROM is required when RESEND_API_KEY is set",
    path: ["EMAIL_FROM"],
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
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ORG_NOTIFY_EMAIL: process.env.ORG_NOTIFY_EMAIL,
  STRIPE_PCT_FEE: process.env.STRIPE_PCT_FEE,
  STRIPE_FIXED_FEE_CENTS: process.env.STRIPE_FIXED_FEE_CENTS,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
