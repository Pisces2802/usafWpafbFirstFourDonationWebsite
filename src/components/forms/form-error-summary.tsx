"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ref } from "react";

type FormErrorSummaryProps = {
  ref: Ref<HTMLDivElement>;
  id: string;
  items: { href: string; message: string }[];
};

/** Lists every invalid field with a link that moves focus to it. Receives focus on failed submit. */
export const FormErrorSummary = ({ ref, id, items }: FormErrorSummaryProps) => {
  const t = useTranslations("Forms");
  const titleId = `${id}-title`;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-labelledby={titleId}
      className="border-destructive bg-destructive/5 focus-visible:outline-ring rounded-xl border-2 p-5 focus-visible:outline-3 focus-visible:outline-offset-2 sm:p-6"
    >
      <h2 id={titleId} className="text-destructive flex items-center gap-2 text-lg font-semibold">
        <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
        {t("errorSummaryTitle", { count: items.length })}
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="text-destructive inline-flex min-h-11 items-center font-medium underline underline-offset-2 sm:min-h-0 sm:py-1"
            >
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
