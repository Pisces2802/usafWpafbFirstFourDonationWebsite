import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, ComingSoon, RequirePermission } from "@/components/admin/admin-page";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("funds");

const FundsPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.funds")} lead={t("funds.lead")}>
      <Suspense>
        <RequirePermission permission="funds:manage">
          <ComingSoon plan={t("funds.plan")} />
        </RequirePermission>
      </Suspense>
    </AdminPage>
  );
};

export default FundsPage;
