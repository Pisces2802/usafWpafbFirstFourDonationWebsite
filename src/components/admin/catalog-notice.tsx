"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CatalogNotice as Notice } from "@/hooks/use-catalog-action";

/** The result of the last campaign or fund change, announced to screen readers. */
export const CatalogNotice = ({ notice }: { notice: Notice | null }) => {
  const t = useTranslations("Admin.catalog.errors");

  return (
    <div aria-live="polite" className="empty:hidden">
      {notice?.kind === "error" && (
        <p role="alert" className="text-destructive inline-flex items-center gap-2 text-sm">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {t(notice.error)}
        </p>
      )}
      {notice?.kind === "success" && (
        <p role="status" className="inline-flex items-center gap-2 text-sm">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
          {notice.message}
        </p>
      )}
    </div>
  );
};
