import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";

import { siteConfig } from "@/config/site";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const requested = explicitLocale ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  // No locale anywhere means a back-office route (`/admin` has no `[locale]` segment). It's
  // English-only, and its strings stay out of the public site's message bundle.
  if (requested === undefined) {
    const admin = (await import("../../messages/admin/en.json")).default;
    return { locale, timeZone: siteConfig.timeZone, messages: { ...messages, Admin: admin } };
  }

  return { locale, timeZone: siteConfig.timeZone, messages };
});
