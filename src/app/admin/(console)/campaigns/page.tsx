import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { CampaignsBoard } from "@/components/admin/campaigns-board";
import { loadCampaigns } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("campaigns");

const Campaigns = async () => {
  const campaigns = await loadCampaigns();
  if (!campaigns) return <NoDatabase />;
  return <CampaignsBoard campaigns={campaigns} />;
};

const CampaignsPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.campaigns")} lead={t("campaigns.lead")}>
      <Suspense fallback={<TableSkeleton rows={3} />}>
        <Campaigns />
      </Suspense>
    </AdminPage>
  );
};

export default CampaignsPage;
