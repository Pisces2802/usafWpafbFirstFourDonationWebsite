import { getTranslations } from "next-intl/server";

import { connection } from "next/server";

import { DonateForm } from "@/components/donation/donate-form";
import { env } from "@/env";
import { getActiveCampaignProgress, getCampaignProgress } from "@/lib/campaign-progress";
import { campaignSlugSchema } from "@/lib/donation-schema";
import { getActiveFunds } from "@/lib/fund-settings";
import { getPageMetadata } from "@/lib/metadata";

export const generateMetadata = ({ params }: PageProps<"/[locale]/donate">) =>
  getPageMetadata(params, { titleKey: "donate", href: "/donate" });

const DonatePage = async ({ searchParams }: { searchParams: Promise<Record<string, string>> }) => {
  const t = await getTranslations("Donate");
  const funds = await getActiveFunds();

  const params = await searchParams;
  await connection();
  const slugParsed = campaignSlugSchema.safeParse(params.campaign);
  const campaignProgress = slugParsed.success
    ? await getCampaignProgress(slugParsed.data)
    : await getActiveCampaignProgress(new Date());

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8 lg:py-16">
      <header className="max-w-2xl">
        <h1 className="headline text-5xl lg:text-6xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-4 text-xl">{t("lead")}</p>
      </header>

      <div className="mt-10">
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
      </div>
    </div>
  );
};

export default DonatePage;
