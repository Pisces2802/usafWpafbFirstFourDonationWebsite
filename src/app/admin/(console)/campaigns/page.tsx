import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, ComingSoon, RequirePermission } from "@/components/admin/admin-page";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("campaigns");

const CampaignsPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.campaigns")} lead={t("campaigns.lead")}>
      <Suspense>
        <RequirePermission permission="campaigns:manage">
          <ComingSoon plan={t("campaigns.plan")} />
        </RequirePermission>
      </Suspense>
    </AdminPage>
  );
};

export default CampaignsPage;
