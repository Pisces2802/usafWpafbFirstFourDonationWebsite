"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";

/**
 * Turnstile for the signed-out back-office forms. `widget` goes above the submit button (it stays
 * invisible unless Cloudflare wants an interaction); `take()` hands over the current token and
 * resets the widget, since each token works once. Without a site key both do nothing.
 */
export const useAuthTurnstile = (siteKey: string | null) => {
  const ref = useRef<TurnstileInstance>(undefined);
  const [token, setToken] = useState<string | null>(null);

  const take = () => {
    if (!siteKey) return undefined;
    const current = token ?? undefined;
    setToken(null);
    ref.current?.reset();
    return current;
  };

  const widget = siteKey ? (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      onSuccess={setToken}
      onExpire={() => setToken(null)}
      onError={() => setToken(null)}
      options={{ appearance: "interaction-only", size: "flexible", language: "en" }}
      className="empty:hidden"
    />
  ) : null;

  return { widget, take };
};
