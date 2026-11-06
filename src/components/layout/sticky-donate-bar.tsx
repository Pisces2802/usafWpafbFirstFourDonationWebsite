"use client";

import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { useStickyDonateBar } from "@/hooks/use-sticky-donate-bar";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const StickyDonateBar = () => {
  const t = useTranslations("Common");
  const { isVisible } = useStickyDonateBar();

  return (
    <div
      inert={!isVisible}
      className={cn(
        "surface-night fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 motion-reduce:transition-none md:hidden",
        isVisible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <Link
        href="/donate"
        className={cn(buttonVariants({ variant: "donate", size: "touch" }), "w-full")}
      >
        {t("donateNow")}
      </Link>
    </div>
  );
};
