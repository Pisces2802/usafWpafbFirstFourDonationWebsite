"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Pie, PieChart } from "recharts";

import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { isFundId } from "@/config/donation";
import type { AdminDashboardInsights } from "@/lib/admin/queries";
import { MONEY_FORMAT } from "@/lib/money";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** All-time net giving split by fund: a donut with the total in the middle and a legend beside it. */
export const FundBreakdown = ({ byFund }: { byFund: AdminDashboardInsights["byFund"] }) => {
  const t = useTranslations("Admin.dashboard.byFund");
  const tFunds = useTranslations("Funds");
  const format = useFormatter();
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);

  if (!byFund.length) return <p className="text-muted-foreground text-sm">{t("empty")}</p>;

  const total = byFund.reduce((sum, row) => sum + row.netCents, 0);
  const slices = byFund.map((row, index) => ({
    name: isFundId(row.fund) ? tFunds(`${row.fund}.name`) : row.fund,
    netCents: row.netCents,
    fill: COLORS[index % COLORS.length],
    share: format.number(row.netCents / total, { style: "percent", maximumFractionDigits: 0 }),
  }));
  const config: ChartConfig = Object.fromEntries(
    slices.map((slice) => [slice.name, { label: slice.name, color: slice.fill }]),
  );

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative size-44 shrink-0">
        <ChartContainer config={config} className="aspect-square size-44" aria-hidden="true">
          <PieChart>
            <Pie
              data={slices}
              dataKey="netCents"
              nameKey="name"
              innerRadius={54}
              outerRadius={84}
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums">{money(total)}</span>
          <span className="text-muted-foreground text-xs">{t("total")}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-3 text-sm">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: slice.fill }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="text-muted-foreground tabular-nums">{money(slice.netCents)}</span>
            <span className="w-10 text-right font-semibold tabular-nums">{slice.share}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
