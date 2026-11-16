import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { CampaignsBoard } from "@/components/admin/campaigns-board";
import { requireAdmin } from "@/lib/admin/access";
import { loadCampaigns } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("campaigns");

const Campaigns = async () => {
  const campaigns = await loadCampaigns();
  if (!campaigns) return <NoDatabase />;
  const user = await requireAdmin();
  return (
    <CampaignsBoard
      campaigns={campaigns}
      currentUserId={user.id}
      abilities={{
        create: can(user, "campaigns:create"),
        edit: can(user, "campaigns:edit"),
        delete: can(user, "campaigns:delete"),
        approve: can(user, "campaigns:approve"),
      }}
    />
  );
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
