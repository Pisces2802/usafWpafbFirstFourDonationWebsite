import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, TableSkeleton } from "@/components/admin/admin-page";
import { StoryForm } from "@/components/admin/story-form";
import { requireAdmin } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { can } from "@/lib/admin/permissions";
import { cloudinaryConfigured } from "@/lib/stories/cloudinary";

export const generateMetadata = adminMetadata("stories");

const NewStoryForm = async () => {
  const user = await requireAdmin("stories:create");
  return (
    <StoryForm
      story={null}
      canUploadImages={cloudinaryConfigured()}
      canPublish={can(user, "stories:publish")}
    />
  );
};

const NewStoryPage = async () => {
  const t = await getTranslations("Admin.stories");

  return (
    <AdminPage title={t("newTitle")}>
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <NewStoryForm />
      </Suspense>
    </AdminPage>
  );
};

export default NewStoryPage;
