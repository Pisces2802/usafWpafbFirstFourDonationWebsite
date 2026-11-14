import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ClearDonation } from "@/components/thank-you/clear-donation";
import { ShareCard } from "@/components/thank-you/share-card";
import { buttonVariants } from "@/components/ui/button";
import { env } from "@/env";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lookUpGift } from "@/lib/gifts";
import { getPageMetadata } from "@/lib/metadata";
import { MONEY_FORMAT } from "@/lib/money";
import { cn } from "@/lib/utils";

type ThankYouProps = PageProps<"/[locale]/donate/thank-you">;

export const generateMetadata = async ({ params }: ThankYouProps): Promise<Metadata> => ({
  ...(await getPageMetadata(params, { titleKey: "thankYou", href: "/donate/thank-you" })),
  robots: { index: false, follow: false },
});

const contactLink = (chunks: React.ReactNode) => (
  <Link href="/contact" className="text-foreground font-semibold underline underline-offset-2">
    {chunks}
  </Link>
);

const manageLink = (chunks: React.ReactNode) => (
  <Link
    href="/manage-giving"
    className="text-foreground font-semibold underline underline-offset-2"
  >
    {chunks}
  </Link>
);

const ThankYouContent = async ({ params, searchParams }: ThankYouProps) => {
  const { locale } = (await params) as { locale: Locale };
  const { session_id: sessionId } = await searchParams;
  const result = await lookUpGift(typeof sessionId === "string" ? sessionId : undefined);

  if (result?.status === "open") redirect({ href: "/donate", locale });

  const t = await getTranslations("ThankYou");
  const tFunds = await getTranslations("Funds");
  const format = await getFormatter();

  if (result?.status !== "complete") {
    return (
      <header className="max-w-2xl">
        <h1 className="headline text-5xl lg:text-6xl">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground mt-4 text-xl">
          {t.rich("notFoundBody", { link: contactLink })}
        </p>
      </header>
    );
  }

  const { gift } = result;
  const homeUrl = `${env.NEXT_PUBLIC_SITE_URL}${getPathname({ locale, href: "/" })}`;

  return (
    <>
      <ClearDonation />
      <header className="max-w-3xl">
        <h1 className="headline motion-safe:animate-hero-rise text-5xl lg:text-7xl">
          {gift.firstName ? t("title", { name: gift.firstName }) : t("titleNoName")}
        </h1>
        <p className="motion-safe:animate-hero-rise-lead mt-6 text-xl">
          {t("confirmation", {
            frequency: gift.frequency,
            amount: format.number(gift.chargedCents / 100, MONEY_FORMAT),
            fund: tFunds(`${gift.fundId}.name`),
          })}
        </p>
      </header>

      <ul className="text-muted-foreground mt-8 flex max-w-2xl flex-col gap-3 text-lg">
        {gift.tribute && (
          <li>{t("tribute", { type: gift.tribute.type, name: gift.tribute.honoreeName })}</li>
        )}
        {gift.email && <li>{t("receipt", { email: gift.email })}</li>}
        {gift.frequency === "monthly" && <li>{t.rich("manageMonthly", { link: manageLink })}</li>}
      </ul>

      <div className="mt-12 max-w-3xl">
        <ShareCard url={homeUrl} />
      </div>
    </>
  );
};

const ThankYouSkeleton = () => (
  <div aria-hidden="true" className="max-w-2xl animate-pulse">
    <div className="bg-muted h-16 w-3/4 rounded-lg" />
    <div className="bg-muted mt-6 h-6 w-full rounded" />
    <div className="bg-muted mt-3 h-6 w-2/3 rounded" />
  </div>
);

const ThankYouPage = async (props: ThankYouProps) => {
  const t = await getTranslations("ThankYou");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24">
      <Suspense fallback={<ThankYouSkeleton />}>
        <ThankYouContent {...props} />
      </Suspense>
      <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "touch" }), "mt-12")}>
        {t("backHome")}
      </Link>
    </div>
  );
};

export default ThankYouPage;
