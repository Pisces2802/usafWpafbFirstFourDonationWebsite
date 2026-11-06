import "server-only";

import Stripe from "stripe";

import { env } from "@/env";

/** Pinned so a Stripe account upgrade can't change payload shapes under us. */
const STRIPE_API_VERSION = "2026-10-28.endive";

let client: Stripe | null = null;

/** Server-side Stripe client, or null when `STRIPE_SECRET_KEY` isn't configured. */
export const getStripe = () => {
  if (!env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return client;
};
