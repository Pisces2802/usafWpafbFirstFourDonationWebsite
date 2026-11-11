import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { FundsList } from "@/components/admin/funds-list";
import { loadFunds } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("funds");

const Funds = async () => {
  const funds = await loadFunds();
  if (!funds) return <NoDatabase />;
  return <FundsList funds={funds} />;
};

const FundsPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.funds")} lead={t("funds.lead")}>
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <Funds />
      </Suspense>
    </AdminPage>
  );
};

export default FundsPage;
