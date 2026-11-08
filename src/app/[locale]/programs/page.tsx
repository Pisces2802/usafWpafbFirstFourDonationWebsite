import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActionBand } from "@/components/layout/action-band";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { stories } from "@/config/stories";
import { Link } from "@/i18n/navigation";
import { getActiveFunds } from "@/lib/fund-settings";
import { getPageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

const STEPS = ["idea", "plan", "run"] as const;
const COVERS = ["item1", "item2", "item3"] as const;

export const generateMetadata = ({ params }: PageProps<"/[locale]/programs">) =>
  getPageMetadata(params, {
    titleKey: "programs",
    href: "/programs",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "Programs" }))("lead"),
  });

const ProgramsPage = async () => {
  const t = await getTranslations("Programs");
  const tFunds = await getTranslations("Funds");
  const tStories = await getTranslations("Stories");
  const tAbout = await getTranslations("About");
  const funds = await getActiveFunds();

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <section
        aria-labelledby="how-heading"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24"
      >
        <h2 id="how-heading" className="headline text-4xl md:text-5xl">
          {t("howHeading")}
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-4 md:flex-col">
              <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold tabular-nums"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-condensed text-2xl leading-tight">
                  {t(`steps.${step}.title`)}
                </h3>
                <p className="text-muted-foreground mt-2 text-lg">{t(`steps.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="funds-heading" className="bg-muted/60 border-y">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24">
          <h2 id="funds-heading" className="headline text-4xl md:text-5xl">
            {t("fundsHeading")}
          </h2>
          <ul className="mt-10 flex flex-col gap-6">
            {funds.map((id) => {
              const story = stories.find((candidate) => candidate.fundId === id);
              const name = tFunds(`${id}.name`);

              return (
                <li
                  key={id}
                  id={id}
                  className="bg-card ring-foreground/10 grid scroll-mt-28 gap-6 rounded-xl p-6 ring-1 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12"
                >
                  <div className="flex flex-col">
                    <h3 className="font-condensed text-3xl leading-tight">{name}</h3>
                    <p className="text-muted-foreground mt-3 text-lg">
                      {tFunds(`${id}.description`)}
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:mt-auto lg:pt-6">
                      <Link
                        href={{ pathname: "/donate", query: { fund: id } }}
                        aria-label={tFunds("giveToFundLabel", { fund: name })}
                        className={buttonVariants({ size: "touch" })}
                      >
                        {tFunds("giveToFund")}
                      </Link>
                      {story && (
                        <Link
                          href={{ pathname: "/stories/[slug]", params: { slug: story.slug } }}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "touch" }),
                            "text-primary",
                          )}
                        >
                          {tStories("readStory", { name: tStories(`items.${story.slug}.name`) })}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold">{t("coversLabel")}</h4>
                    <ul className="mt-3 flex flex-col gap-3">
                      {COVERS.map((item) => (
                        <li key={item} className="flex gap-3 text-lg">
                          <span
                            aria-hidden="true"
                            className="bg-primary/10 text-primary mt-1 grid size-6 shrink-0 place-items-center rounded-full"
                          >
                            <Check className="size-3.5" />
                          </span>
                          {t(`covers.${id}.${item}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="join-heading"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-20"
      >
        <div className="border-primary flex flex-col gap-6 border-l-4 pl-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 id="join-heading" className="headline text-4xl">
              {t("joinHeading")}
            </h2>
            <p className="text-muted-foreground mt-3 text-xl">{t("joinBody")}</p>
          </div>
          <Link
            href={{ pathname: "/contact", query: { topic: "airmen" } }}
            className={cn(buttonVariants({ variant: "outline", size: "touch" }), "shrink-0")}
          >
            {t("joinCta")}
          </Link>
        </div>
      </section>

      <ActionBand id="programs-action" title={tAbout("ctaHeading")} body={tAbout("ctaBody")} />
    </>
  );
};

export default ProgramsPage;
