import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Shown in place of the donate form while an owner has paused online giving. */
export const GivingPausedNotice = async () => {
  const t = await getTranslations("Donate.paused");

  return (
    <section
      aria-labelledby="giving-paused-heading"
      className="border-primary flex max-w-3xl flex-col gap-6 border-l-4 pl-6"
    >
      <div>
        <h2 id="giving-paused-heading" className="headline text-4xl">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground mt-3 text-xl">{t("body")}</p>
      </div>
      <Link
        href={{ pathname: "/contact", query: { topic: "giving" } }}
        className={cn(buttonVariants({ variant: "outline", size: "touch" }), "self-start")}
      >
        {t("cta")}
      </Link>
    </section>
  );
};
