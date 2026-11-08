import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/home/section-heading";
import type { FundId } from "@/config/donation";
import { Link } from "@/i18n/navigation";

export const FundsSection = ({ funds }: { funds: readonly FundId[] }) => {
  const t = useTranslations("Funds");

  return (
    <section
      aria-labelledby="funds-heading"
      className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 lg:py-28"
    >
      <SectionHeading id="funds-heading" lead={t("lead")}>
        {t("heading")}
      </SectionHeading>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {funds.map((id) => (
          <li
            key={id}
            className="group/fund bg-card ring-foreground/10 has-focus-visible:outline-ring hover:ring-primary/60 relative flex flex-col rounded-xl p-6 ring-1 transition-shadow duration-200 has-focus-visible:outline-3 has-focus-visible:outline-offset-2"
          >
            <h3 className="font-condensed text-2xl leading-tight">{t(`${id}.name`)}</h3>
            <p className="text-muted-foreground mt-3 flex-1">{t(`${id}.description`)}</p>
            <Link
              href={{ pathname: "/donate", query: { fund: id } }}
              aria-label={t("giveToFundLabel", { fund: t(`${id}.name`) })}
              className="text-primary mt-6 inline-flex min-h-11 items-center gap-2 font-semibold outline-none after:absolute after:inset-0 after:rounded-xl"
            >
              {t("giveToFund")}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover/fund:translate-x-1"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
