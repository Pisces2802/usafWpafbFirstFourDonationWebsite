"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { applyNewsletterLink, type NewsletterLinkState } from "@/lib/newsletter-actions";

type NewsletterLinkFormProps = {
  action: "confirm" | "unsubscribe";
  token: string;
};

/** The button behind an emailed confirm or unsubscribe link, and what happened after. */
export const NewsletterLinkForm = ({ action, token }: NewsletterLinkFormProps) => {
  const t = useTranslations("Newsletter");
  const [state, formAction, pending] = useActionState<NewsletterLinkState, FormData>(
    applyNewsletterLink,
    null,
  );
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state) resultRef.current?.focus();
  }, [state]);

  if (state === "confirmed" || state === "unsubscribed") {
    return (
      <div className="flex flex-col items-start gap-4">
        <CircleCheck aria-hidden="true" className="text-primary size-10" />
        <h2
          ref={resultRef}
          tabIndex={-1}
          className="font-condensed text-3xl leading-tight outline-none"
        >
          {t(`${state}.title`)}
        </h2>
        <p className="text-muted-foreground text-lg">{t(`${state}.body`)}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-4">
      <h2
        ref={state ? resultRef : undefined}
        tabIndex={-1}
        className="font-condensed text-3xl leading-tight outline-none"
      >
        {state ? t(`problem.${state}.title`) : t(`${action}.prompt`)}
      </h2>
      <p className="text-muted-foreground text-lg">
        {state ? t(`problem.${state}.body`) : t(`${action}.lead`)}
      </p>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="token" value={token} />
      {state !== "invalid" && (
        <Button type="submit" size="touch" aria-disabled={pending || undefined}>
          {pending ? t("working") : t(`${action}.button`)}
        </Button>
      )}
    </form>
  );
};
