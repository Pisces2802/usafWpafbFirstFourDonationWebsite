import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/brand/logo";
import { siteConfig } from "@/config/site";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Admin");

  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 sm:py-16"
    >
      <p className="inline-flex items-center gap-2.5">
        <LogoMark />
        <span className="font-condensed text-xl leading-none">
          {t("titleSuffix", { orgName: siteConfig.orgName })}
        </span>
      </p>
      <div className="bg-card ring-foreground/10 w-full max-w-md rounded-2xl p-6 ring-1 sm:p-8">
        {children}
      </div>
    </main>
  );
}
