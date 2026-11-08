"use client";

import { Check, CircleCheck, Copy, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";

type InviteNoticeProps = {
  /** What happened, e.g. "Added Sam as Treasurer." */
  message: ReactNode;
  /** The set-up link, when the email couldn't be sent and it has to be passed on by hand. */
  link: string | null;
};

/** After an invite: a confirmation, or the link to share when the email didn't go. */
export const InviteNotice = ({ message, link }: InviteNoticeProps) => {
  const t = useTranslations("Admin.team");
  const { copied, copy } = useCopy();

  if (!link) {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
        {message}
      </p>
    );
  }

  return (
    <div role="status" className="bg-muted/60 flex flex-col gap-3 rounded-xl p-4 text-sm">
      <p className="flex gap-2">
        <TriangleAlert aria-hidden="true" className="text-taxiway mt-0.5 size-4 shrink-0" />
        {message}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="bg-background flex-1 rounded-lg px-3 py-2 font-mono text-xs break-all">
          {link}
        </code>
        <Button type="button" variant="outline" size="touch" onClick={() => copy(link)}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>
    </div>
  );
};
