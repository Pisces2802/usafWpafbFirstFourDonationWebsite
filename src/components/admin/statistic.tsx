import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "error" | "info" | "success" | "warning";

const VARIANT_STYLES: Record<Variant, string> = {
  default: "border-t-foreground/20",
  error: "border-t-destructive",
  info: "border-t-primary",
  success: "border-t-emerald-600",
  warning: "border-t-taxiway",
};

type StatisticProps = {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  variant?: Variant;
  className?: string;
};

/** One headline number with a label and an optional line explaining what it counts. */
export const Statistic = ({
  label,
  value,
  description,
  variant = "default",
  className,
}: StatisticProps) => (
  <div
    className={cn(
      "bg-card ring-foreground/10 flex flex-col gap-1 rounded-xl border-t-4 p-5 ring-1",
      VARIANT_STYLES[variant],
      className,
    )}
  >
    <dt className="text-muted-foreground text-sm font-medium">{label}</dt>
    <dd className="font-condensed text-4xl leading-tight tabular-nums">{value}</dd>
    {description && <dd className="text-muted-foreground text-sm">{description}</dd>}
  </div>
);
