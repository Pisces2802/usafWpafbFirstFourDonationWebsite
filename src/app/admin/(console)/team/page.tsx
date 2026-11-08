import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { RolesReference } from "@/components/admin/roles-reference";
import { TeamTabs } from "@/components/admin/team-tabs";
import { loadTeam } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("team");

const Team = async () => {
  const team = await loadTeam();
  if (!team) return <NoDatabase />;

  return (
    <TeamTabs
      members={team.members}
      currentUserId={team.currentUserId}
      roles={<RolesReference />}
    />
  );
};

const TeamPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.team")} lead={t("team.lead")}>
      <Suspense fallback={<TableSkeleton />}>
        <Team />
      </Suspense>
    </AdminPage>
  );
};

export default TeamPage;
