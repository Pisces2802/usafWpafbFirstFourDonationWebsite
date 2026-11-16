import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { StoriesBoard } from "@/components/admin/stories-board";
import { requireAdmin } from "@/lib/admin/access";
import { loadStories } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("stories");

const Stories = async () => {
  const stories = await loadStories();
  if (!stories) return <NoDatabase />;
  const user = await requireAdmin();
  return (
    <StoriesBoard
      stories={stories}
      abilities={{
        create: can(user, "stories:create"),
        edit: can(user, "stories:edit"),
        delete: can(user, "stories:delete"),
      }}
    />
  );
};

const StoriesPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.stories")} lead={t("stories.lead")}>
      <Suspense fallback={<TableSkeleton rows={3} />}>
        <Stories />
      </Suspense>
    </AdminPage>
  );
};

export default StoriesPage;
