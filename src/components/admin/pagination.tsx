"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

const PAGE_SIZES = ["10", "20", "50", "100"];

export const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: Props) => {
  const t = useTranslations("Admin.table.pagination");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm",
        className,
      )}
    >
      <p className="text-muted-foreground tabular-nums">{t("range", { start, end, total })}</p>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <label className="text-muted-foreground hidden items-center gap-2 sm:flex">
            {t("rows")}
            <Select
              onValueChange={(value) => onPageSizeChange(Number(value))}
              value={pageSize.toString()}
            >
              <SelectTrigger className="border-border bg-card h-9 w-20 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("previous")}
            className="bg-card rounded-full"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-16 text-center font-semibold tabular-nums">
            {t("page", { page, pages: totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("next")}
            className="bg-card rounded-full"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
};
