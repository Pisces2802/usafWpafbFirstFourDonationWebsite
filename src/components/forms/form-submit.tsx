"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, type Ref, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { FormStatus } from "@/hooks/use-form-submission";
import { Link } from "@/i18n/navigation";

type FormSubmitProps = {
  label: ReactNode;
  status: FormStatus;
  turnstileSiteKey: string | null;
  turnstileRef: Ref<TurnstileInstance | undefined>;
  onTurnstileToken: (token: string | null) => void;
};

/** Turnstile, the submit button, any send error, and the privacy line at the foot of a form. */
export const FormSubmit = ({
  label,
  status,
  turnstileSiteKey,
  turnstileRef,
  onTurnstileToken,
}: FormSubmitProps) => {
  const t = useTranslations("Forms");
  const locale = useLocale();
  const isSending = status === "sending";
  const problem = status !== "idle" && status !== "sending" && status !== "sent" ? status : null;

  return (
    <div className="flex flex-col gap-4">
      {turnstileSiteKey && (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={onTurnstileToken}
          onExpire={() => onTurnstileToken(null)}
          onError={() => onTurnstileToken(null)}
          options={{
            appearance: "interaction-only",
            size: "flexible",
            theme: "dark",
            language: locale,
          }}
          className="empty:hidden"
        />
      )}
      <p role="status" aria-live="polite" className="text-destructive empty:hidden">
        {problem && t(`status.${problem}`)}
      </p>
      <Button
        type="submit"
        size="touch"
        aria-disabled={isSending || undefined}
        className="self-start"
      >
        {isSending ? t("sending") : label}
      </Button>
      <p className="text-muted-foreground text-sm">
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/privacy" className="text-foreground underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
};

type FormSentProps = {
  title: ReactNode;
  body: ReactNode;
  onStartOver: () => void;
};

/** Confirmation that replaces a form once it's sent. Takes focus so screen readers announce it. */
export const FormSent = ({ title, body, onStartOver }: FormSentProps) => {
  const t = useTranslations("Forms");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="bg-card ring-foreground/10 flex flex-col items-start gap-4 rounded-xl p-6 ring-1 sm:p-8">
      <CircleCheck aria-hidden="true" className="text-primary size-10" />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-condensed text-3xl leading-tight outline-none"
      >
        {title}
      </h2>
      <p className="text-muted-foreground text-lg">{body}</p>
      <Button type="button" variant="outline" size="touch" onClick={onStartOver}>
        {t("sendAnother")}
      </Button>
    </div>
  );
};
