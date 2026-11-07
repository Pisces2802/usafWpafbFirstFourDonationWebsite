import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActionBand } from "@/components/layout/action-band";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";
import { getPageMetadata } from "@/lib/metadata";

const AREAS = ["morale", "welfare", "growth", "community"] as const;
const PRINCIPLES = ["airmen", "choice", "open"] as const;
const ROLES = ["president", "vicePresident", "secretary", "treasurer"] as const;

export const generateMetadata = ({ params }: PageProps<"/[locale]/about">) =>
  getPageMetadata(params, {
    titleKey: "about",
    href: "/about",
    description: async (locale) => (await getTranslations({ locale, namespace: "About" }))("lead"),
  });

const AboutPage = async () => {
  const t = await getTranslations("About");
  const { orgName } = siteConfig;

  return (
    <>
      <PageHeader title={t("title", { orgName })} lead={t("lead")} />

      <section
        aria-labelledby="mission-heading"
        className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 lg:py-24"
      >
        <h2 id="mission-heading" className="headline text-4xl md:text-5xl">
          {t("missionHeading")}
        </h2>
        <div className="flex max-w-[65ch] flex-col gap-5 text-xl leading-relaxed">
          <p>{t("missionBody1")}</p>
          <p>{t("missionBody2", { orgName })}</p>
        </div>
      </section>

      <section
        aria-labelledby="areas-heading"
        className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8 lg:pb-24"
      >
        <h2 id="areas-heading" className="headline text-4xl md:text-5xl">
          {t("areasHeading")}
        </h2>
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((key) => (
            <li key={key} className="border-primary border-l-4 pl-5">
              <h3 className="font-condensed text-2xl leading-tight">{t(`areas.${key}.title`)}</h3>
              <p className="text-muted-foreground mt-2 text-lg">{t(`areas.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="principles-heading" className="bg-muted/60 border-y">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24">
          <h2 id="principles-heading" className="headline text-4xl md:text-5xl">
            {t("principlesHeading")}
          </h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {PRINCIPLES.map((key) => (
              <li key={key} className="border-primary border-t-4 pt-6">
                <h3 className="font-condensed text-2xl leading-tight">
                  {t(`principles.${key}.title`)}
                </h3>
                <p className="text-muted-foreground mt-3 text-lg">
                  {t(`principles.${key}.body`, { orgName })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="team-heading"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24"
      >
        <div className="max-w-3xl">
          <h2 id="team-heading" className="headline text-4xl md:text-5xl">
            {t("teamHeading")}
          </h2>
          <p className="text-muted-foreground mt-4 text-xl">{t("teamLead")}</p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <li
              key={role}
              className="bg-card ring-foreground/10 flex items-center gap-4 rounded-xl p-5 ring-1"
            >
              <span
                aria-hidden="true"
                className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center rounded-full"
              >
                <UserRound className="size-6" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{t(`roles.${role}`)}</span>
                <span className="text-muted-foreground text-sm">{t("nameToCome")}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="independence-heading" className="surface-night">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
          <h2 id="independence-heading" className="headline text-4xl md:text-5xl">
            {t("independenceHeading")}
          </h2>
          <div className="flex max-w-[65ch] flex-col gap-5 text-lg">
            <p>{t("independenceBody1", { orgName })}</p>
            <p className="text-muted-foreground">{t("independenceBody2", { orgName })}</p>
          </div>
        </div>
      </section>

      <ActionBand id="about-action" title={t("ctaHeading")} body={t("ctaBody")} />
    </>
  );
};

export default AboutPage;
