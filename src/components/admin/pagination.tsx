"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

const PAGE_SIZES = ["10", "20", "50", "100"];

const pageButton =
  "flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-black transition-colors outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-black/25 disabled:pointer-events-none disabled:opacity-40";

const numberFormat = new Intl.NumberFormat("en-NG");

export const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3 text-sm",
        className,
      )}
    >
      <p className="text-neutral-600 tabular-nums">
        {numberFormat.format(start)}–{numberFormat.format(end)} of {numberFormat.format(total)}
      </p>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <label className="hidden items-center gap-2 text-neutral-600 sm:flex">
            Rows
            <Select
              onValueChange={(value) => onPageSizeChange(Number(value))}
              value={pageSize.toString()}
            >
              <SelectTrigger className="h-9 w-20 rounded-full border-neutral-200 bg-white">
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
          <button
            type="button"
            aria-label="Previous page"
            className={pageButton}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-16 text-center font-semibold tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            className={pageButton}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </nav>
  );
};
