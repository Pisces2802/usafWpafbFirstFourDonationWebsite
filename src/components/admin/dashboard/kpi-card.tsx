import { ArrowUpRight, type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type KpiCardProps = {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  /** Formatted change against the previous period, and which way it went. */
  change?: { text: ReactNode; direction: "up" | "down" | "flat" };
  /** Shown under the value: what the change compares, or what the number counts. */
  footnote?: ReactNode;
  href?: string;
  hrefLabel?: string;
  isHighlighted?: boolean;
};

const CHANGE_ICONS = { up: TrendingUp, down: TrendingDown, flat: null } as const;

/** One headline number in a card, with an optional change badge and a link to its full list. */
export const KpiCard = ({
  icon: Icon,
  label,
  value,
  change,
  footnote,
  href,
  hrefLabel,
  isHighlighted = false,
}: KpiCardProps) => {
  const ChangeIcon = change ? CHANGE_ICONS[change.direction] : null;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 ring-1",
        isHighlighted
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-card ring-foreground/10",
      )}
    >
      {isHighlighted && (
        <span
          aria-hidden="true"
          className="bg-taxiway/25 pointer-events-none absolute -top-16 -right-16 size-44 rounded-full blur-2xl"
        />
      )}
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            isHighlighted ? "bg-taxiway text-night" : "bg-accent text-primary",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        {href && (
          <Link
            href={href}
            aria-label={hrefLabel}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-full border transition-colors",
              isHighlighted
                ? "border-primary-foreground/40 hover:bg-primary-foreground/10"
                : "border-border hover:bg-accent",
            )}
          >
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <dt
          className={cn(
            "text-sm font-medium",
            isHighlighted ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {label}
        </dt>
        <dd className="font-condensed text-4xl leading-tight tabular-nums">{value}</dd>
      </div>
      {(change || footnote) && (
        <dd
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs",
            isHighlighted ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {change && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                change.direction === "up" &&
                  (isHighlighted ? "text-taxiway" : "text-emerald-600 dark:text-emerald-400"),
                change.direction === "down" &&
                  (isHighlighted ? "text-primary-foreground" : "text-destructive"),
              )}
            >
              {ChangeIcon && <ChangeIcon aria-hidden="true" className="size-3.5" />}
              {change.text}
            </span>
          )}
          {footnote}
        </dd>
      )}
    </div>
  );
};
