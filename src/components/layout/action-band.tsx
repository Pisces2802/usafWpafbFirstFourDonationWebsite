import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type ActionBandProps = {
  id: string;
  title: ReactNode;
  body: ReactNode;
};

/** Closing band with the two main actions: give, or volunteer. */
export const ActionBand = async ({ id, title, body }: ActionBandProps) => {
  const t = await getTranslations();

  return (
    <section aria-labelledby={id} className="bg-ultramarine text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-16 sm:px-8 md:flex-row md:items-end md:justify-between lg:py-20">
        <div className="max-w-2xl">
          <h2 id={id} className="headline text-4xl md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-xl text-white/85">{body}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link href="/donate" className={buttonVariants({ variant: "donate", size: "touch" })}>
            {t("Common.donateNow")}
          </Link>
          <Link
            href="/get-involved"
            className={cn(
              buttonVariants({ variant: "outline", size: "touch" }),
              "border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white",
            )}
          >
            {t("Home.volunteer")}
          </Link>
        </div>
      </div>
    </section>
  );
};
