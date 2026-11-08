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
        "border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm",
        className,
      )}
    >
      <p className="text-muted-foreground tabular-nums">
        {numberFormat.format(start)}–{numberFormat.format(end)} of {numberFormat.format(total)}
      </p>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <label className="text-muted-foreground hidden items-center gap-2 sm:flex">
            Rows
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
            aria-label="Previous page"
            className="bg-card rounded-full"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-16 text-center font-semibold tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Next page"
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
