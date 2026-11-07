import { useTranslations } from "next-intl";

import { HeroVideo } from "@/components/hero/hero-video";
import { buttonVariants } from "@/components/ui/button";
import { env } from "@/env";
import { HERO_ID } from "@/hooks/use-sticky-donate-bar";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const HeroSection = () => {
  const t = useTranslations();

  return (
    <section
      id={HERO_ID}
      className="surface-night relative isolate flex min-h-[calc(100svh-4rem)] flex-col justify-end overflow-hidden lg:min-h-[calc(100svh-5rem)]"
    >
      <HeroVideo
        baseUrl={env.NEXT_PUBLIC_HERO_VIDEO_BASE_URL}
        pauseLabel={t("Home.pauseVideo")}
        playLabel={t("Home.playVideo")}
      />

      <div
        aria-hidden="true"
        className="max-md:bg-night/65 pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(14_28_54/0.95)_0%,rgb(14_28_54/0)_45%),linear-gradient(to_right,rgb(14_28_54/0.9)_0%,rgb(14_28_54/0.78)_42%,rgb(14_28_54/0.35)_75%,rgb(14_28_54/0.15)_100%)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-24 pb-16 sm:px-8 md:pb-32">
        <h1 className="headline text-hero motion-safe:animate-hero-rise sm:max-w-[14ch]">
          {t("Home.heroTitle")}
        </h1>
        <p className="text-muted-foreground motion-safe:animate-hero-rise-lead mt-6 text-xl">
          {t("Home.heroLead")}
        </p>
        <div className="motion-safe:animate-hero-rise-actions mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/donate" className={buttonVariants({ variant: "donate", size: "touch" })}>
            {t("Common.donateNow")}
          </Link>
          <Link
            href={{ pathname: "/get-involved", hash: "volunteer" }}
            className={cn(
              buttonVariants({ variant: "outline", size: "touch" }),
              "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white",
            )}
          >
            {t("Home.volunteer")}
          </Link>
        </div>
      </div>
    </section>
  );
};
