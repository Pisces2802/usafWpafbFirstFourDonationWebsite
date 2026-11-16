"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNewsletterForm } from "@/hooks/use-newsletter-form";
import { Link } from "@/i18n/navigation";
import { NEWSLETTER_CONFIRM_DAYS } from "@/lib/form-schemas";
import { cn } from "@/lib/utils";

type NewsletterSignupProps = {
  /** `footer` is the compact, dark version; `page` sits on a card on /newsletter. */
  variant: "footer" | "page";
  turnstileSiteKey: string | null;
};

/**
 * Email-only newsletter sign-up. In the footer, Turnstile loads only once someone focuses the
 * field, so the script isn't on every page for every visitor.
 */
export const NewsletterSignup = ({ variant, turnstileSiteKey }: NewsletterSignupProps) => {
  const t = useTranslations("Newsletter");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const id = `newsletter-email-${variant}`;
  const [armed, setArmed] = useState(variant === "page");
  const sentRef = useRef<HTMLParagraphElement>(null);
  const {
    register,
    submit,
    invalidFields,
    status,
    sent,
    startOver,
    turnstileRef,
    setTurnstileToken,
  } = useNewsletterForm({ requiresTurnstile: turnstileSiteKey !== null });

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const isFooter = variant === "footer";

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p ref={sentRef} tabIndex={-1} className="text-lg outline-none">
          {t("sent", { email: sent.email, days: NEWSLETTER_CONFIRM_DAYS })}
        </p>
        <Button
          type="button"
          variant="link"
          onClick={startOver}
          className={cn("h-11 px-0 underline underline-offset-2", isFooter && "text-white")}
        >
          {t("useAnother")}
        </Button>
      </div>
    );
  }

  const error = invalidFields.includes("email") ? t("errors.email") : null;
  const problem = status !== "idle" && status !== "sending" && status !== "sent" ? status : null;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={id} className={cn("font-medium", isFooter ? "text-white" : "text-sm")}>
        {isFooter ? t("footerEmail") : t("email")}
      </label>
      <p id={hintId} className="text-muted-foreground -mt-1 text-sm">
        {t("hint")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id={id}
          type="email"
          autoComplete="email"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error && errorId].filter(Boolean).join(" ")}
          onFocus={() => setArmed(true)}
          className="bg-background border-border h-11 px-3 md:text-base"
          {...register("email")}
        />
        <Button type="submit" size="touch" aria-disabled={status === "sending" || undefined}>
          {status === "sending" ? tForms("sending") : t("submit")}
        </Button>
      </div>
      {error && (
        <p id={errorId} className={cn("text-sm", isFooter ? "text-white" : "text-destructive")}>
          {error}
        </p>
      )}
      {turnstileSiteKey && armed && (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
          options={{
            appearance: "interaction-only",
            size: "flexible",
            theme: "dark",
            language: locale,
          }}
          className="empty:hidden"
        />
      )}
      <p role="status" aria-live="polite" className="text-sm empty:hidden">
        {problem && tForms(`status.${problem}`)}
      </p>
      <p className="text-muted-foreground text-sm">
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/privacy" className="text-foreground underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
};
