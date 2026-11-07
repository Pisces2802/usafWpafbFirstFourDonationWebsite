import { FileText } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { type LegalDoc, legalConfig } from "@/config/legal";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";
import type { Locale, StaticPathname } from "@/i18n/routing";
import type { ContactTopic } from "@/lib/form-schemas";

type PageLinkProps = {
  href: StaticPathname;
  topic?: ContactTopic;
  children: ReactNode;
};

/** Locale-aware link for MDX bodies: `<PageLink href="/contact" topic="giving">…</PageLink>`. */
const PageLink = ({ href, topic, children }: PageLinkProps) => (
  <Link
    href={topic ? { pathname: href, query: { topic } } : href}
    className="text-primary font-semibold underline underline-offset-2"
  >
    {children}
  </Link>
);

export const LegalPage = async ({ doc }: { doc: LegalDoc }) => {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Legal");
  const tPages = await getTranslations("Pages");
  const format = await getFormatter();
  const { default: Body } = await doc.body[locale]();
  const { orgName } = siteConfig;

  return (
    <>
      <PageHeader title={tPages(doc.titleKey)}>
        <p className="text-muted-foreground mt-6">
          {t("lastUpdated", {
            date: format.dateTime(new Date(`${legalConfig.lastUpdated}T12:00:00Z`), {
              dateStyle: "long",
            }),
          })}
        </p>
      </PageHeader>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8 lg:py-16">
        <div className="max-w-[70ch] min-w-0">
          {legalConfig.isDraft && (
            <p className="bg-muted text-muted-foreground ring-foreground/10 mb-10 flex gap-3 rounded-lg p-4 ring-1">
              <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              {t("draftNotice", { orgName })}
            </p>
          )}
          <Body orgName={orgName} components={{ PageLink }} />
        </div>
      </div>
    </>
  );
};
