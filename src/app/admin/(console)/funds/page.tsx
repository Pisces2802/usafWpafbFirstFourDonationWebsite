import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { FundsList } from "@/components/admin/funds-list";
import { requireAdmin } from "@/lib/admin/access";
import { loadFunds } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("funds");

const Funds = async () => {
  const funds = await loadFunds();
  if (!funds) return <NoDatabase />;
  const user = await requireAdmin();
  return <FundsList funds={funds} canEdit={can(user, "funds:edit")} />;
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
