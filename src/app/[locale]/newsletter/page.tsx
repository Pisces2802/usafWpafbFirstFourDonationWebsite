import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NewsletterPanel } from "@/components/forms/newsletter-panel";
import { PageHeader } from "@/components/layout/page-header";
import { env } from "@/env";
import { getPageMetadata } from "@/lib/metadata";

const NEXT_STEPS = ["item1", "item2", "item3"] as const;

// Emailed links carry a personal token in the query, so the page stays out of search results.
export const generateMetadata = async ({
  params,
}: PageProps<"/[locale]/newsletter">): Promise<Metadata> => ({
  ...(await getPageMetadata(params, {
    titleKey: "newsletter",
    href: "/newsletter",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "Newsletter" }))("lead"),
  })),
  robots: { index: false, follow: false },
});

const NewsletterPage = async () => {
  const t = await getTranslations("Newsletter");
  const tPages = await getTranslations("Pages");

  return (
    <>
      <PageHeader title={tPages("newsletter")} lead={t("lead")} />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16 lg:py-24">
        <section className="bg-card ring-foreground/10 min-w-0 self-start rounded-xl p-5 ring-1 sm:p-8">
          <NewsletterPanel turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />
        </section>

        <aside aria-labelledby="newsletter-next-heading">
          <h2 id="newsletter-next-heading" className="font-condensed text-2xl">
            {t("nextHeading")}
          </h2>
          <ol className="mt-5 flex flex-col gap-4">
            {NEXT_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-lg">
                <span
                  aria-hidden="true"
                  className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{t(`next.${step}`)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
};

export default NewsletterPage;
