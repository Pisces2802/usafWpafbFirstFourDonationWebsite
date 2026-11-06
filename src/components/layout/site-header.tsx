import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavLink } from "@/components/layout/nav-link";
import { buttonVariants } from "@/components/ui/button";
import { mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const SiteHeader = () => {
  const t = useTranslations();

  return (
    <header className="surface-night sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-8 lg:h-20">
        <Link
          href="/"
          aria-label={t("Common.homeLink", { orgName: siteConfig.orgName })}
          className="mr-auto inline-flex min-h-11 items-center rounded-sm"
        >
          <Logo />
        </Link>

        <nav aria-label={t("Header.mainNavLabel")} className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {mainNav.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="link-underline aria-[current=page]:decoration-taxiway font-medium decoration-2"
                >
                  {t(`Pages.${item.labelKey}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <LocaleSwitcher className="hidden sm:inline-flex" />

        <Link
          href="/donate"
          className={cn(
            buttonVariants({ variant: "donate", size: "touch" }),
            "hidden sm:inline-flex",
          )}
        >
          {t("Common.donate")}
        </Link>

        <MobileMenu />
      </div>
    </header>
  );
};
