"use client";

import { type DateTimeFormatOptions, useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { TrendPoint, TrendRange } from "@/lib/admin/queries";
import { MONEY_FORMAT } from "@/lib/money";
import { cn } from "@/lib/utils";

const RANGES: TrendRange[] = ["daily", "weekly", "monthly"];

const CONFIG = { netCents: { color: "var(--chart-1)" } } satisfies ChartConfig;

const TICK_FORMAT: Record<TrendRange, DateTimeFormatOptions> = {
  daily: { month: "short", day: "numeric", timeZone: "UTC" },
  weekly: { month: "short", day: "numeric", timeZone: "UTC" },
  monthly: { month: "short", year: "2-digit", timeZone: "UTC" },
};

/** Buckets come back as UTC dates ("2026-05-22"); read them as UTC so they don't shift a day. */
const toDate = (bucket: string) => new Date(`${bucket}T00:00:00Z`);

/** Net giving over time as an area chart, with a daily / weekly / monthly switch. */
export const DonationTrends = ({ trends }: { trends: Record<TrendRange, TrendPoint[]> }) => {
  const t = useTranslations("Admin.dashboard.trends");
  const format = useFormatter();
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [range, setRange] = useState<TrendRange>("daily");

  const points = trends[range];
  const total = points.reduce((sum, point) => sum + point.netCents, 0);
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);
  const compactMoney = (cents: number) =>
    format.number(cents / 100, { ...MONEY_FORMAT, notation: "compact", maximumFractionDigits: 1 });
  const tick = (bucket: string) => format.dateTime(toDate(bucket), TICK_FORMAT[range]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-condensed text-4xl leading-tight tabular-nums">{money(total)}</p>
          <p className="text-muted-foreground text-sm">{t(`total.${range}`)}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={t("rangeLabel")}
          className="bg-muted flex gap-1 rounded-full p-1"
        >
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={range === option}
              onClick={() => setRange(option)}
              className={cn(
                "focus-visible:ring-ring rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2",
                range === option
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`ranges.${option}`)}
            </button>
          ))}
        </div>
      </div>
      <ChartContainer
        config={CONFIG}
        className="aspect-auto h-64 w-full"
        role="img"
        aria-label={t("chartLabel", { range: t(`total.${range}`), total: money(total) })}
      >
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-netCents)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-netCents)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={24}
            tickFormatter={tick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => compactMoney(value)}
          />
          <Tooltip
            cursor={{ strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as TrendPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="bg-night rounded-lg px-3 py-2 text-white shadow-lg">
                  <p className="text-sm font-semibold tabular-nums">{money(point.netCents)}</p>
                  <p className="text-xs text-white/70">{tick(point.bucket)}</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="netCents"
            stroke="var(--color-netCents)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
};
