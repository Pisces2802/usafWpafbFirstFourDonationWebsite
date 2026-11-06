"use client";

import { Check, Mail, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { useShare } from "@/hooks/use-share";
import { cn } from "@/lib/utils";

export const ShareCard = ({ url }: { url: string }) => {
  const t = useTranslations("ThankYou");
  const { orgName } = siteConfig;
  const { share, status } = useShare({ url, title: orgName });
  const mailto = `mailto:?subject=${encodeURIComponent(t("emailSubject", { orgName }))}&body=${encodeURIComponent(t("emailBody", { orgName, url }))}`;

  return (
    <section
      aria-labelledby="share-heading"
      className="bg-card text-card-foreground ring-foreground/10 rounded-xl p-6 ring-1 sm:p-8"
    >
      <h2 id="share-heading" className="font-condensed text-2xl sm:text-3xl">
        {t("shareHeading")}
      </h2>
      <p className="text-muted-foreground mt-2">{t("shareBody", { orgName })}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={share}
          className={cn(buttonVariants({ variant: "default", size: "touch" }))}
        >
          {status === "copied" ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
          {status === "copied" ? t("copied") : t("share")}
        </button>
        <a href={mailto} className={cn(buttonVariants({ variant: "outline", size: "touch" }))}>
          <Mail aria-hidden="true" />
          {t("emailFriend")}
        </a>
      </div>
      <p aria-live="polite" className="text-muted-foreground mt-3 min-h-5 text-sm">
        {status === "copied"
          ? t("copiedNote")
          : status === "failed"
            ? t("copyFailed", { url })
            : null}
      </p>
    </section>
  );
};
