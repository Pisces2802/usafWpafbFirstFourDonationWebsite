import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ContactForm } from "@/components/forms/contact-form";
import { PageHeader } from "@/components/layout/page-header";
import { env } from "@/env";
import { Link } from "@/i18n/navigation";
import { getPageMetadata } from "@/lib/metadata";

const NEXT_STEPS = ["item1", "item2", "item3"] as const;

export const generateMetadata = ({ params }: PageProps<"/[locale]/contact">) =>
  getPageMetadata(params, {
    titleKey: "contact",
    href: "/contact",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "Contact" }))("lead"),
  });

const linkClass =
  "text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline";

const ContactPage = async () => {
  const t = await getTranslations("Contact");
  const tPages = await getTranslations("Pages");

  return (
    <>
      <PageHeader title={tPages("contact")} lead={t("lead")} />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16 lg:py-24">
        <section
          aria-labelledby="contact-form-heading"
          className="bg-card ring-foreground/10 min-w-0 rounded-xl p-5 ring-1 sm:p-8"
        >
          <h2 id="contact-form-heading" className="font-condensed mb-6 text-3xl">
            {t("formHeading")}
          </h2>
          <ContactForm turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />
        </section>

        <aside className="flex flex-col gap-12">
          <section aria-labelledby="contact-next-heading">
            <h2 id="contact-next-heading" className="font-condensed text-2xl">
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
          </section>

          <section aria-labelledby="contact-elsewhere-heading">
            <h2 id="contact-elsewhere-heading" className="font-condensed text-2xl">
              {t("elsewhereHeading")}
            </h2>
            <ul className="mt-3 flex flex-col">
              <li>
                <Link href={{ pathname: "/get-involved", hash: "volunteer" }} className={linkClass}>
                  {t("volunteerLink")}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
              <li>
                <Link href="/donate" className={linkClass}>
                  {t("donateLink")}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
};

export default ContactPage;
