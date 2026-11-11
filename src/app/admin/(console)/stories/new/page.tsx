import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, RequirePermission, TableSkeleton } from "@/components/admin/admin-page";
import { StoryForm } from "@/components/admin/story-form";
import { adminMetadata } from "@/lib/admin/metadata";
import { cloudinaryConfigured } from "@/lib/stories/cloudinary";

export const generateMetadata = adminMetadata("stories");

const NewStoryPage = async () => {
  const t = await getTranslations("Admin.stories");

  return (
    <AdminPage title={t("newTitle")}>
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <RequirePermission permission="stories:manage">
          <StoryForm story={null} canUploadImages={cloudinaryConfigured()} />
        </RequirePermission>
      </Suspense>
    </AdminPage>
  );
};

export default NewStoryPage;
