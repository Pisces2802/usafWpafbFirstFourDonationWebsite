import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { DonateForm } from "@/components/donation/donate-form";
import { env } from "@/env";
import { getActiveCampaignProgress, getCampaignProgress } from "@/lib/campaign-progress";
import { campaignSlugSchema } from "@/lib/donation-schema";
import { getActiveFunds } from "@/lib/fund-settings";
import { getPageMetadata } from "@/lib/metadata";

type DonateProps = PageProps<"/[locale]/donate">;

export const generateMetadata = ({ params }: DonateProps) =>
  getPageMetadata(params, { titleKey: "donate", href: "/donate" });

/**
 * Reads `searchParams` and the current time, so it must render inside `<Suspense>` to keep the
 * rest of the page prerenderable under Cache Components.
 */
const DonateContent = async ({ searchParams }: Pick<DonateProps, "searchParams">) => {
  const params = await searchParams;
  // Opt into request time before `new Date()` so the active campaign reflects "now", not build time.
  await connection();

  const funds = await getActiveFunds();
  const slugParsed = campaignSlugSchema.safeParse(params.campaign);
  const campaignProgress = slugParsed.success
    ? await getCampaignProgress(slugParsed.data)
    : await getActiveCampaignProgress(new Date());

  return (
    <DonateForm
      funds={funds}
      feeRates={{ pct: env.STRIPE_PCT_FEE, fixedCents: env.STRIPE_FIXED_FEE_CENTS }}
      isTaxDeductible={env.NEXT_PUBLIC_TAX_DEDUCTIBLE}
      stripePublishableKey={
        env.STRIPE_SECRET_KEY ? (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null) : null
      }
      turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
      campaignProgress={campaignProgress}
    />
  );
};

const DonateSkeleton = () => (
  <div aria-hidden="true" className="grid animate-pulse gap-6 lg:grid-cols-[2fr_1fr]">
    <div className="bg-muted h-[32rem] rounded-xl" />
    <div className="bg-muted h-80 rounded-xl" />
  </div>
);

const DonatePage = async ({ searchParams }: DonateProps) => {
  const t = await getTranslations("Donate");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8 lg:py-16">
      <header className="max-w-2xl">
        <h1 className="headline text-5xl lg:text-6xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-4 text-xl">{t("lead")}</p>
      </header>

      <div className="mt-10">
        <Suspense fallback={<DonateSkeleton />}>
          <DonateContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
};

export default DonatePage;
