"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stripePromises = new Map<string, Promise<Stripe | null>>();

const getStripePromise = (publishableKey: string) => {
  let promise = stripePromises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, promise);
  }
  return promise;
};

type CheckoutPanelProps = {
  publishableKey: string;
  clientSecret: string;
  onEdit: () => void;
};

/** Hosts Stripe's embedded Checkout. Moves focus to its heading when it opens. */
export const CheckoutPanel = ({ publishableKey, clientSecret, onEdit }: CheckoutPanelProps) => {
  const t = useTranslations("Donate");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="donate-checkout-heading"
      className="bg-card text-card-foreground ring-foreground/10 min-w-0 rounded-xl p-4 ring-1 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          ref={headingRef}
          id="donate-checkout-heading"
          tabIndex={-1}
          className="font-condensed scroll-mt-32 text-2xl outline-none sm:text-3xl"
        >
          {t("checkoutHeading")}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className={cn(buttonVariants({ variant: "outline", size: "touch" }))}
        >
          <ArrowLeft aria-hidden="true" />
          {t("editGift")}
        </button>
      </div>

      <div className="mt-6 min-h-[32rem] overflow-hidden rounded-lg bg-white">
        <EmbeddedCheckoutProvider
          key={clientSecret}
          stripe={getStripePromise(publishableKey)}
          options={{ clientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </section>
  );
};
