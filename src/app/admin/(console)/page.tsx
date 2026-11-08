import {
  ChartSpline,
  HandCoins,
  HeartHandshake,
  PieChart,
  Receipt,
  Repeat,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { CampaignProgress } from "@/components/admin/dashboard/campaign-progress";
import { DonationTrends } from "@/components/admin/dashboard/donation-trends";
import { FundBreakdown } from "@/components/admin/dashboard/fund-breakdown";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { Panel } from "@/components/admin/dashboard/panel";
import { RecentGifts } from "@/components/admin/dashboard/recent-gifts";
import { loadOverview } from "@/lib/admin/data";
import { MONEY_FORMAT } from "@/lib/money";

const average = (cents: number, count: number) => (count > 0 ? cents / count : 0);

const Overview = async () => {
  const data = await loadOverview();
  if (!data) return <NoDatabase />;

  const t = await getTranslations("Admin.dashboard");
  const format = await getFormatter();
  const { overview, insights, recent, canViewDonors } = data;
  const { current, previous } = insights;
  const canViewDonations = recent !== null;
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);

  /** Change between the last 30 days and the 30 before, as a badge. Nothing when both are zero. */
  const change = (now: number, before: number) => {
    if (before === 0)
      return now > 0 ? { text: t("changeNew"), direction: "up" as const } : undefined;
    const ratio = (now - before) / before;
    const text = format.number(ratio, {
      style: "percent",
      maximumFractionDigits: 0,
      signDisplay: "exceptZero",
    });
    const direction = ratio > 0.005 ? "up" : ratio < -0.005 ? "down" : "flat";
    return { text, direction } as const;
  };

  const donationsLink = canViewDonations
    ? { href: "/admin/donations", hrefLabel: t("openDonations") }
    : {};
  const donorsLink = canViewDonors ? { href: "/admin/donors", hrefLabel: t("openDonors") } : {};

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          isHighlighted
          icon={HandCoins}
          label={t("net")}
          value={money(overview.netCents)}
          change={change(current.netCents, previous.netCents)}
          footnote={t("change")}
          {...donationsLink}
        />
        <KpiCard
          icon={Users}
          label={t("donors")}
          value={format.number(overview.donorCount)}
          change={change(current.donorCount, previous.donorCount)}
          footnote={t("change")}
          {...donorsLink}
        />
        <KpiCard
          icon={Receipt}
          label={t("average")}
          value={money(average(overview.netCents, overview.giftCount))}
          change={change(
            average(current.netCents, current.giftCount),
            average(previous.netCents, previous.giftCount),
          )}
          footnote={t("change")}
          {...donationsLink}
        />
        <KpiCard
          icon={Repeat}
          label={t("monthly")}
          value={format.number(overview.monthlyDonorCount)}
          footnote={t("monthlyHint")}
          {...donorsLink}
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Panel id="trends-heading" title={t("trends.heading")} icon={ChartSpline}>
            <DonationTrends trends={insights.trends} />
            <dl className="border-border grid grid-cols-3 gap-4 border-t pt-4">
              {[
                { label: t("gifts"), value: format.number(overview.giftCount) },
                { label: t("fees"), value: money(overview.feesCoveredCents) },
                { label: t("refunded"), value: money(overview.refundedCents) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">{item.label}</dt>
                  <dd className="font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {recent && (
            <Panel
              id="recent-heading"
              title={t("recentHeading")}
              icon={HeartHandshake}
              action={
                <Link
                  href="/admin/donations"
                  className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {t("viewAll")}
                </Link>
              }
            >
              {recent.length ? (
                <RecentGifts rows={recent} />
              ) : (
                <p className="text-muted-foreground text-sm">{t("empty")}</p>
              )}
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel id="funds-heading" title={t("byFund.heading")} icon={PieChart}>
            <FundBreakdown byFund={insights.byFund} />
          </Panel>
          <Panel id="campaigns-heading" title={t("campaigns.heading")} icon={Target}>
            <CampaignProgress campaigns={insights.campaigns} />
          </Panel>
        </div>
      </div>
    </>
  );
};

const DashboardPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.dashboard")} lead={t("dashboard.lead")}>
      <Suspense fallback={<TableSkeleton />}>
        <Overview />
      </Suspense>
    </AdminPage>
  );
};

export default DashboardPage;
