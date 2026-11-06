import { HeroSection } from "@/components/hero/hero-section";
import { FundsSection } from "@/components/home/funds-section";
import { ImpactStats } from "@/components/home/impact-stats";
import { PartnerLogos } from "@/components/home/partner-logos";
import { QuickGiveBar } from "@/components/home/quick-give-bar";
import { VolunteerBand } from "@/components/home/volunteer-band";
import { WaysIn } from "@/components/home/ways-in";
import { env } from "@/env";
import type { Locale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/metadata";

export const generateMetadata = async ({ params }: PageProps<"/[locale]">) => {
  const { locale } = await params;
  return buildPageMetadata({ locale: locale as Locale, pathname: "/" });
};

const HomePage = () => (
  <>
    <HeroSection />
    <QuickGiveBar isTaxDeductible={env.NEXT_PUBLIC_TAX_DEDUCTIBLE} />
    <ImpactStats />
    <FundsSection />
    <WaysIn />
    <PartnerLogos />
    <VolunteerBand />
  </>
);

export default HomePage;
