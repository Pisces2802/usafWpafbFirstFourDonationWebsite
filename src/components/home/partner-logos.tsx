import Image from "next/image";
import { useTranslations } from "next-intl";

import { partners } from "@/config/home";

export const PartnerLogos = () => {
  const t = useTranslations("Partners");

  if (partners.length === 0) return null;

  return (
    <section
      aria-labelledby="partners-heading"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8"
    >
      <h2 id="partners-heading" className="text-muted-foreground text-lg font-medium">
        {t("heading")}
      </h2>
      <ul className="mt-6 flex flex-wrap items-center gap-x-12 gap-y-8">
        {partners.map((partner) => {
          const logo = (
            <Image
              src={partner.logo}
              alt={partner.name}
              className="h-10 w-auto opacity-80 grayscale"
            />
          );
          return (
            <li key={partner.name}>
              {partner.href ? (
                <a href={partner.href} target="_blank" rel="noopener noreferrer" className="block">
                  {logo}
                </a>
              ) : (
                logo
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
