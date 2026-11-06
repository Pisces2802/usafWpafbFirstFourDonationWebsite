import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const VolunteerBand = () => {
  const t = useTranslations("VolunteerBand");

  return (
    <section aria-labelledby="volunteer-band-heading" className="bg-ultramarine text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-16 sm:px-8 md:flex-row md:items-end md:justify-between lg:py-20">
        <div className="max-w-2xl">
          <h2 id="volunteer-band-heading" className="headline text-4xl md:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-xl text-white/85">{t("body")}</p>
        </div>
        <Link
          href="/get-involved"
          className={cn(
            buttonVariants({ size: "touch" }),
            "text-ultramarine shrink-0 bg-white hover:bg-white/90 focus-visible:ring-white/50",
          )}
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
};
