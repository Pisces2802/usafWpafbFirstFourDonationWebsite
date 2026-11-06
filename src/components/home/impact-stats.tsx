import { useFormatter, useTranslations } from "next-intl";

import { impactStats } from "@/config/home";

export const ImpactStats = () => {
  const t = useTranslations("Stats");
  const format = useFormatter();

  if (impactStats.length === 0) return null;

  return (
    <section
      aria-labelledby="impact-heading"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8"
    >
      <h2 id="impact-heading" className="sr-only">
        {t("heading")}
      </h2>
      <dl className="grid gap-10 text-center sm:grid-cols-3">
        {impactStats.slice(0, 3).map((stat) => (
          <div key={stat.id} className="flex flex-col-reverse gap-2">
            <dt className="text-muted-foreground text-lg">{t(stat.id, { count: stat.value })}</dt>
            <dd className="font-condensed text-primary text-6xl leading-none tabular-nums">
              {format.number(stat.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
