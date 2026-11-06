"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useLocaleHref } from "@/hooks/use-locale-href";
import { cn } from "@/lib/utils";

type LocaleLinksProps = {
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
};

export const LocaleLinks = ({ className, linkClassName, onNavigate }: LocaleLinksProps) => {
  const t = useTranslations("LocaleSwitcher");
  const activeLocale = useLocale();
  const href = useLocaleHref();

  return (
    <ul className={className}>
      {routing.locales.map((locale) => (
        <li key={locale}>
          <Link
            href={href}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            aria-current={locale === activeLocale ? "true" : undefined}
            onClick={onNavigate}
            className={cn(
              "link-underline inline-flex min-h-11 items-center aria-[current]:font-semibold",
              linkClassName,
            )}
          >
            {t("locale", { locale })}
          </Link>
        </li>
      ))}
    </ul>
  );
};
