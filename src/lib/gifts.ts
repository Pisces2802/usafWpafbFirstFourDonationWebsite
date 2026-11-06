import "server-only";

import { type Frequency, type FundId, isFundId } from "@/config/donation";
import { getStripe } from "@/lib/stripe";

export type CompletedGift = {
  frequency: Frequency;
  fundId: FundId;
  chargedCents: number;
  firstName: string;
  email: string | null;
  tribute: { type: "honour" | "memory"; honoreeName: string } | null;
};

export type GiftLookup = { status: "complete"; gift: CompletedGift } | { status: "open" } | null;

/**
 * Reads a gift straight from its Checkout Session, so the thank-you page works even if the webhook
 * hasn't landed yet. Returns null for unknown, expired or malformed session ids.
 */
export const lookUpGift = async (sessionId: string | undefined): Promise<GiftLookup> => {
  const stripe = getStripe();
  if (!stripe || !sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") return { status: "open" };
    if (session.status !== "complete") return null;

    const metadata = session.metadata ?? {};
    const tributeType = metadata.tributeType;

    return {
      status: "complete",
      gift: {
        frequency: session.mode === "subscription" ? "monthly" : "one_time",
        fundId: isFundId(metadata.fundId) ? metadata.fundId : "general",
        chargedCents: session.amount_total ?? 0,
        firstName: metadata.donorFirstName ?? "",
        email: session.customer_details?.email ?? session.customer_email,
        tribute:
          (tributeType === "honour" || tributeType === "memory") && metadata.honoreeName
            ? { type: tributeType, honoreeName: metadata.honoreeName }
            : null,
      },
    };
  } catch {
    return null;
  }
};
