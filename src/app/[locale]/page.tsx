import { getTranslations } from "next-intl/server";

import { HeroSection } from "@/components/hero/hero-section";
import { FeaturedStory } from "@/components/home/featured-story";
import { FundsSection } from "@/components/home/funds-section";
import { ImpactStats } from "@/components/home/impact-stats";
import { PartnerLogos } from "@/components/home/partner-logos";
import { QuickGiveBar } from "@/components/home/quick-give-bar";
import { VolunteerBand } from "@/components/home/volunteer-band";
import { WaysIn } from "@/components/home/ways-in";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import type { Locale } from "@/i18n/routing";
import { getActiveFunds } from "@/lib/fund-settings";
import { buildPageMetadata } from "@/lib/metadata";
import { buildOrganizationJsonLd, serializeJsonLd } from "@/lib/seo";

export const generateMetadata = async ({ params }: PageProps<"/[locale]">) => {
  const { locale } = await params;
  return buildPageMetadata({ locale: locale as Locale, href: "/" });
};

const HomePage = async ({ params }: PageProps<"/[locale]">) => {
  const locale = (await params).locale as Locale;
  const [funds, t] = await Promise.all([
    getActiveFunds(),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);
  const organization = buildOrganizationJsonLd({
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    locale,
    name: siteConfig.orgName,
    description: t("description"),
    ein: env.NEXT_PUBLIC_TAX_DEDUCTIBLE ? env.ORG_EIN : undefined,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organization) }}
      />
      <HeroSection />
      <QuickGiveBar isTaxDeductible={env.NEXT_PUBLIC_TAX_DEDUCTIBLE} funds={funds} />
      <ImpactStats />
      <FundsSection funds={funds} />
      <FeaturedStory />
      <WaysIn />
      <PartnerLogos />
      <VolunteerBand />
    </>
  );
};

export default HomePage;
