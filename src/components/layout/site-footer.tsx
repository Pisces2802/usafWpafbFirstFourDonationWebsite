import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { LocaleLinks } from "@/components/layout/locale-links";
import { footerExploreNav, footerLegalNav, type NavItem } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { Link } from "@/i18n/navigation";

const linkClassName =
  "link-underline inline-flex min-h-11 items-center hover:text-white transition-colors";

const FooterNav = ({ id, heading, items }: { id: string; heading: string; items: NavItem[] }) => {
  const t = useTranslations("Pages");

  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="font-condensed text-xl text-white">
        {heading}
      </h2>
      <ul className="mt-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkClassName}>
              {t(item.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export const SiteFooter = () => {
  const t = useTranslations("Footer");
  const { orgName } = siteConfig;

  return (
    <footer className="surface-night pb-28 md:pb-0">
      <div className="text-muted-foreground mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="text-white">
          <Logo />
        </div>

        <FooterNav id="footer-explore" heading={t("exploreHeading")} items={footerExploreNav} />
        <FooterNav id="footer-legal" heading={t("legalHeading")} items={footerLegalNav} />

        <section aria-labelledby="footer-language">
          <h2 id="footer-language" className="font-condensed text-xl text-white">
            {t("languageHeading")}
          </h2>
          <LocaleLinks className="mt-3" linkClassName={linkClassName} />
        </section>
      </div>

      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm sm:px-8">
          {env.NEXT_PUBLIC_TAX_DEDUCTIBLE && env.ORG_EIN && (
            <p>{t("taxStatus", { orgName, ein: env.ORG_EIN })}</p>
          )}
          <p>{t("disclaimer", { orgName })}</p>
        </div>
      </div>
    </footer>
  );
};
