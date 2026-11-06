import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const requested = explicitLocale ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    timeZone: "America/New_York",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
