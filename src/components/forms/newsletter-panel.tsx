"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { NewsletterLinkForm } from "@/components/forms/newsletter-link-form";
import { NewsletterSignup } from "@/components/forms/newsletter-signup";

type EmailLink = { action: "confirm" | "unsubscribe"; token: string };

const subscribeToNothing = () => () => {};

let cached: { search: string; link: EmailLink | null } | null = null;

/** `?confirm=<token>` or `?unsubscribe=<token>` from an email; null on the server. */
const readLink = (): EmailLink | null => {
  const { search } = window.location;
  if (cached?.search === search) return cached.link;
  const params = new URLSearchParams(search);
  const action = (["unsubscribe", "confirm"] as const).find((name) => params.get(name));
  const link = action ? { action, token: params.get(action) ?? "" } : null;
  cached = { search, link };
  return link;
};

/**
 * The card on /newsletter: the sign-up form, or the button for an emailed link. The link is read
 * in the browser, so the page itself stays static.
 */
export const NewsletterPanel = ({ turnstileSiteKey }: { turnstileSiteKey: string | null }) => {
  const t = useTranslations("Newsletter");
  const link = useSyncExternalStore(subscribeToNothing, readLink, () => null);

  if (link) return <NewsletterLinkForm action={link.action} token={link.token} />;

  return (
    <>
      <h2 className="font-condensed mb-6 text-3xl">{t("formHeading")}</h2>
      <NewsletterSignup variant="page" turnstileSiteKey={turnstileSiteKey} />
    </>
  );
};
