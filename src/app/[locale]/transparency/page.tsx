import { ArrowRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { Link } from "@/i18n/navigation";
import { grossUpCents } from "@/lib/fees";
import { getPageMetadata } from "@/lib/metadata";
import { MONEY_FORMAT } from "@/lib/money";
import { cn } from "@/lib/utils";

const REPORT_ITEMS = ["item1", "item2", "item3"] as const;
const EXAMPLE_GIFT_CENTS = 10_000;

export const generateMetadata = ({ params }: PageProps<"/[locale]/transparency">) =>
  getPageMetadata(params, {
    titleKey: "transparency",
    href: "/transparency",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "Transparency" }))("lead"),
  });

const sectionClass =
  "mx-auto grid w-full max-w-7xl gap-6 px-4 py-14 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 lg:py-20";

const TransparencyPage = async () => {
  const t = await getTranslations("Transparency");
  const tPages = await getTranslations("Pages");
  const format = await getFormatter();
  const { orgName, annualReportYear } = siteConfig;

  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);
  const rates = { pct: env.STRIPE_PCT_FEE, fixedCents: env.STRIPE_FIXED_FEE_CENTS };
  const { feeCents } = grossUpCents(EXAMPLE_GIFT_CENTS, rates);
  const isTaxDeductible = env.NEXT_PUBLIC_TAX_DEDUCTIBLE && env.ORG_EIN;

  return (
    <>
      <PageHeader title={tPages("transparency")} lead={t("lead")} />

      <section aria-labelledby="money-heading" className={sectionClass}>
        <h2 id="money-heading" className="headline text-4xl md:text-5xl">
          {t("moneyHeading")}
        </h2>
        <div className="flex max-w-[65ch] flex-col gap-5 text-xl leading-relaxed">
          <p>{t("moneyBody1")}</p>
          <p>{t("moneyBody2")}</p>
          <Link
            href="/programs"
            className="text-primary inline-flex min-h-11 items-center gap-2 self-start text-lg font-semibold underline-offset-4 hover:underline"
          >
            {t("fundsLink")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="fees-heading" className="bg-muted/60 border-y">
        <div className={sectionClass}>
          <h2 id="fees-heading" className="headline text-4xl md:text-5xl">
            {t("feesHeading")}
          </h2>
          <div className="flex max-w-[65ch] flex-col gap-5 text-xl leading-relaxed">
            <p>
              {t("feesBody", {
                orgName,
                pct: format.number(rates.pct, { style: "percent", maximumFractionDigits: 1 }),
                fixed: money(rates.fixedCents),
              })}
            </p>
            <p className="text-muted-foreground">
              {t("feesExample", { amount: money(EXAMPLE_GIFT_CENTS), fee: money(feeCents) })}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="status-heading" className={sectionClass}>
        <h2 id="status-heading" className="headline text-4xl md:text-5xl">
          {t("statusHeading")}
        </h2>
        <div className="flex max-w-[65ch] flex-col gap-5 text-xl leading-relaxed">
          <p>{t("statusPrivate", { orgName })}</p>
          <p>
            {isTaxDeductible
              ? t("taxDeductible", { orgName, ein: env.ORG_EIN ?? "" })
              : t("taxUnconfirmed", { orgName })}
          </p>
        </div>
      </section>

      <section aria-labelledby="report-heading" className="surface-night">
        <div className={sectionClass}>
          <h2 id="report-heading" className="headline text-4xl md:text-5xl">
            {t("reportHeading")}
          </h2>
          <div className="max-w-[65ch] text-xl leading-relaxed">
            <p>{t("reportBody", { year: annualReportYear })}</p>
            <ul className="mt-5 flex list-disc flex-col gap-2 pl-6 text-lg">
              {REPORT_ITEMS.map((item) => (
                <li key={item}>{t(`reportItems.${item}`)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="finance-questions-heading"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-20"
      >
        <div className="border-primary flex flex-col gap-6 border-l-4 pl-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 id="finance-questions-heading" className="headline text-4xl">
              {t("questionsHeading")}
            </h2>
            <p className="text-muted-foreground mt-3 text-xl">{t("questionsBody")}</p>
          </div>
          <Link
            href={{ pathname: "/contact", query: { topic: "giving" } }}
            className={cn(buttonVariants({ variant: "outline", size: "touch" }), "shrink-0")}
          >
            {t("questionsCta")}
          </Link>
        </div>
      </section>
    </>
  );
};

export default TransparencyPage;
