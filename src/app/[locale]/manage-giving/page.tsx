import { getTranslations } from "next-intl/server";

import { ManageGivingForm } from "@/components/forms/manage-giving-form";
import { PageHeader } from "@/components/layout/page-header";
import { env } from "@/env";
import { Link } from "@/i18n/navigation";
import { MANAGE_LINK_MINUTES } from "@/lib/form-schemas";
import { getPageMetadata } from "@/lib/metadata";

const NEXT_STEPS = ["item1", "item2", "item3"] as const;

export const generateMetadata = ({ params }: PageProps<"/[locale]/manage-giving">) =>
  getPageMetadata(params, {
    titleKey: "manageGiving",
    href: "/manage-giving",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "ManageGiving" }))("lead"),
  });

const ManageGivingPage = async () => {
  const t = await getTranslations("ManageGiving");
  const tPages = await getTranslations("Pages");

  return (
    <>
      <PageHeader title={tPages("manageGiving")} lead={t("lead")} />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16 lg:py-24">
        <section
          aria-labelledby="manage-giving-form-heading"
          className="bg-card ring-foreground/10 min-w-0 self-start rounded-xl p-5 ring-1 sm:p-8"
        >
          <h2 id="manage-giving-form-heading" className="font-condensed mb-6 text-3xl">
            {t("formHeading")}
          </h2>
          <ManageGivingForm turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />
        </section>

        <aside aria-labelledby="manage-giving-next-heading">
          <h2 id="manage-giving-next-heading" className="font-condensed text-2xl">
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
                <span className="pt-0.5">
                  {t(`next.${step}`, { minutes: MANAGE_LINK_MINUTES })}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-8">
            {t.rich("help", {
              link: (chunks) => (
                <Link
                  href={{ pathname: "/contact", query: { topic: "giving" } }}
                  className="text-foreground font-semibold underline underline-offset-2"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </aside>
      </div>
    </>
  );
};

export default ManageGivingPage;
