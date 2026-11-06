import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
  pathnames: {
    "/": "/",
    "/donate": { en: "/donate", es: "/donar", fr: "/faire-un-don" },
    "/donate/thank-you": {
      en: "/donate/thank-you",
      es: "/donar/gracias",
      fr: "/faire-un-don/merci",
    },
    "/about": { en: "/about", es: "/nosotros", fr: "/a-propos" },
    "/programs": { en: "/programs", es: "/programas", fr: "/programmes" },
    "/stories": { en: "/stories", es: "/historias", fr: "/temoignages" },
    "/get-involved": { en: "/get-involved", es: "/participa", fr: "/s-impliquer" },
    "/contact": { en: "/contact", es: "/contacto", fr: "/contact" },
    "/transparency": { en: "/transparency", es: "/transparencia", fr: "/transparence" },
    "/privacy": { en: "/privacy", es: "/privacidad", fr: "/confidentialite" },
    "/donor-privacy": {
      en: "/donor-privacy",
      es: "/privacidad-donantes",
      fr: "/confidentialite-donateurs",
    },
    "/terms": { en: "/terms", es: "/terminos", fr: "/conditions" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
