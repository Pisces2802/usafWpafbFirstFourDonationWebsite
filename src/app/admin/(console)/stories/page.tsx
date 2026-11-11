import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { StoriesBoard } from "@/components/admin/stories-board";
import { loadStories } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("stories");

const Stories = async () => {
  const stories = await loadStories();
  if (!stories) return <NoDatabase />;
  return <StoriesBoard stories={stories} />;
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
