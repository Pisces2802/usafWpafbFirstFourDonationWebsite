import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { DonationsTable } from "@/components/admin/donations-table";
import { Statistic } from "@/components/admin/statistic";
import { loadOverview } from "@/lib/admin/data";

const Overview = async () => {
  const data = await loadOverview();
  if (!data) return <NoDatabase />;

  const t = await getTranslations("Admin.dashboard");
  const format = await getFormatter();
  const { overview, recent } = data;
  const money = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "USD" });

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Statistic
          variant="info"
          label={t("net")}
          value={money(overview.netCents)}
          description={t("netHint")}
        />
        <Statistic
          label={t("gifts")}
          value={format.number(overview.giftCount)}
          description={t("giftsHint")}
        />
        <Statistic
          label={t("donors")}
          value={format.number(overview.donorCount)}
          description={t("donorsHint")}
        />
        <Statistic
          label={t("monthly")}
          value={format.number(overview.monthlyDonorCount)}
          description={t("monthlyHint")}
        />
        <Statistic label={t("fees")} value={money(overview.feesCoveredCents)} />
        <Statistic label={t("refunded")} value={money(overview.refundedCents)} />
      </dl>
      {recent && (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-heading" className="text-2xl font-semibold">
              {t("recentHeading")}
            </h2>
            <Link
              href="/admin/donations"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
          {recent.length ? (
            <DonationsTable rows={recent} isCompact />
          ) : (
            <p className="text-muted-foreground">{t("empty")}</p>
          )}
        </section>
      )}
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
