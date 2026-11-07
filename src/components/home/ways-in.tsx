"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/home/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const ITEMS = ["item1", "item2", "item3"] as const;

/** `isSequence` marks lists that are real steps in order, so they render as numbered steps. */
const AUDIENCES = [
  { id: "donors", href: "/donate", isDonate: true, isSequence: true },
  { id: "airmen", href: "/contact", isDonate: false, isSequence: true },
  { id: "companies", href: "/get-involved", isDonate: false, isSequence: false },
  { id: "volunteers", href: "/get-involved", isDonate: false, isSequence: false },
] as const satisfies readonly {
  id: string;
  href: StaticPathname;
  isDonate: boolean;
  isSequence: boolean;
}[];

export const WaysIn = () => {
  const t = useTranslations("WaysIn");

  return (
    <section aria-labelledby="ways-in-heading" className="bg-muted/60 py-20 lg:py-28">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading id="ways-in-heading" lead={t("lead")}>
          {t("heading")}
        </SectionHeading>

        <Tabs.Root defaultValue={AUDIENCES[0].id}>
          <Tabs.List
            aria-label={t("tabsLabel")}
            className="bg-card ring-foreground/10 relative grid grid-cols-2 gap-1 rounded-xl p-1 ring-1 md:flex"
          >
            <Tabs.Indicator className="bg-primary absolute top-(--active-tab-top) left-(--active-tab-left) h-(--active-tab-height) w-(--active-tab-width) rounded-lg transition-[top,left,width,height] duration-250 ease-out" />
            {AUDIENCES.map((audience) => (
              <Tabs.Tab
                key={audience.id}
                value={audience.id}
                className="data-[active]:text-primary-foreground text-muted-foreground hover:text-foreground focus-visible:outline-ring data-[active]:hover:text-primary-foreground relative z-10 min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-3 md:flex-auto md:text-base md:whitespace-nowrap"
              >
                {t(`${audience.id}.tab`)}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {AUDIENCES.map((audience) => {
            const List = audience.isSequence ? "ol" : "ul";

            return (
              <Tabs.Panel
                key={audience.id}
                value={audience.id}
                className="bg-card ring-foreground/10 focus-visible:outline-ring animate-in fade-in-0 mt-4 rounded-xl p-6 ring-1 duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 sm:p-8"
              >
                <h3 className="font-condensed text-3xl">{t(`${audience.id}.title`)}</h3>
                <p className="text-muted-foreground mt-3 text-lg">{t(`${audience.id}.body`)}</p>

                <h4 className="mt-6 font-semibold">{t(`${audience.id}.listHeading`)}</h4>
                <List className="mt-3 flex flex-col gap-3">
                  {ITEMS.map((item, index) => (
                    <li key={item} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-primary/10 text-primary mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums"
                      >
                        {audience.isSequence ? index + 1 : <Check className="size-3.5" />}
                      </span>
                      <span>{t(`${audience.id}.${item}`)}</span>
                    </li>
                  ))}
                </List>

                <Link
                  href={audience.href}
                  className={cn(
                    buttonVariants({
                      variant: audience.isDonate ? "donate" : "default",
                      size: "touch",
                    }),
                    "mt-8",
                  )}
                >
                  {t(`${audience.id}.cta`)}
                </Link>
              </Tabs.Panel>
            );
          })}
        </Tabs.Root>
      </div>
    </section>
  );
};
