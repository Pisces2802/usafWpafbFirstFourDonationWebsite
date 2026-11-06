import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { getPageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

export type PlaceholderKey =
  | "about"
  | "programs"
  | "stories"
  | "getInvolved"
  | "contact"
  | "transparency"
  | "privacy"
  | "donorPrivacy"
  | "terms"
  | "donate"
  | "thankYou";

type PlaceholderPageProps = {
  titleKey: PlaceholderKey;
};

export const PlaceholderPage = async ({ titleKey }: PlaceholderPageProps) => {
  const t = await getTranslations("Pages");
  const tCommon = await getTranslations("Common");
  const isTransparency = titleKey === "transparency";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24">
      <h1 className="headline text-5xl lg:text-6xl">{t(titleKey)}</h1>
      <p className="text-muted-foreground mt-6 text-xl">
        {isTransparency
          ? t("transparencyPlaceholder", { year: siteConfig.annualReportYear })
          : t("placeholder")}
      </p>
      {titleKey !== "donate" && (
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/donate" className={buttonVariants({ variant: "donate", size: "touch" })}>
            {tCommon("donateNow")}
          </Link>
          {titleKey !== "contact" && (
            <Link
              href="/contact"
              className={cn(buttonVariants({ variant: "outline", size: "touch" }))}
            >
              {t("contact")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export const placeholderMetadata = (
  params: Promise<{ locale: string }>,
  titleKey: PlaceholderKey,
  href: StaticPathname,
): Promise<Metadata> => getPageMetadata(params, { titleKey, href });
