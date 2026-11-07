import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { VolunteerForm } from "@/components/forms/volunteer-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { env } from "@/env";
import { Link } from "@/i18n/navigation";
import type { ContactTopic } from "@/lib/form-schemas";
import { getPageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

const WAYS = [
  { id: "airmen", topic: "airmen" },
  { id: "partners", topic: "partnering" },
  { id: "fundraise", topic: "giving" },
] as const satisfies readonly { id: string; topic: ContactTopic }[];

export const generateMetadata = ({ params }: PageProps<"/[locale]/get-involved">) =>
  getPageMetadata(params, {
    titleKey: "getInvolved",
    href: "/get-involved",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "GetInvolved" }))("lead"),
  });

const GetInvolvedPage = async () => {
  const t = await getTranslations("GetInvolved");
  const tPages = await getTranslations("Pages");
  const tVolunteer = await getTranslations("Volunteer");

  return (
    <>
      <PageHeader title={tPages("getInvolved")} lead={t("lead")} />

      <section
        aria-labelledby="ways-heading"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24"
      >
        <h2 id="ways-heading" className="headline text-4xl md:text-5xl">
          {t("waysHeading")}
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {WAYS.map(({ id, topic }) => (
            <li
              key={id}
              className="bg-card ring-foreground/10 flex flex-col rounded-xl p-6 ring-1 sm:p-8"
            >
              <h3 className="font-condensed text-2xl leading-tight">{t(`ways.${id}.title`)}</h3>
              <p className="text-muted-foreground mt-3 text-lg">{t(`ways.${id}.body`)}</p>
              <Link
                href={{ pathname: "/contact", query: { topic } }}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "touch" }),
                  "text-primary mt-6 -ml-3 h-auto min-h-11 self-start py-2 whitespace-normal md:mt-auto md:pt-6",
                )}
              >
                {t(`ways.${id}.cta`)}
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="volunteer"
        aria-labelledby="volunteer-heading"
        className="bg-muted/60 scroll-mt-20 border-y"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 lg:py-24">
          <div>
            <h2 id="volunteer-heading" className="headline text-4xl md:text-5xl">
              {tVolunteer("heading")}
            </h2>
            <p className="text-muted-foreground mt-4 text-xl">{tVolunteer("lead")}</p>
          </div>
          <div className="bg-card ring-foreground/10 min-w-0 rounded-xl p-5 ring-1 sm:p-8">
            <VolunteerForm turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />
          </div>
        </div>
      </section>
    </>
  );
};

export default GetInvolvedPage;
