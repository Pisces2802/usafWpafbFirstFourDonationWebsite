import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { StoryForm } from "@/components/admin/story-form";
import { requireAdmin } from "@/lib/admin/access";
import { loadStory } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { adminMetadata } from "@/lib/admin/metadata";
import { cloudinaryConfigured } from "@/lib/stories/cloudinary";

type EditStoryProps = PageProps<"/admin/stories/[id]">;

export const generateMetadata = adminMetadata("stories");

const EditStory = async ({ params }: Pick<EditStoryProps, "params">) => {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();

  const story = await loadStory(Number(id));
  if (story === null) return <NoDatabase />;
  if (story === undefined) notFound();
  const user = await requireAdmin();
  return (
    <StoryForm
      story={story}
      canUploadImages={cloudinaryConfigured()}
      canPublish={can(user, "stories:publish")}
    />
  );
};

const EditStoryPage = async ({ params }: EditStoryProps) => {
  const t = await getTranslations("Admin.stories");

  return (
    <AdminPage title={t("editTitle")}>
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <EditStory params={params} />
      </Suspense>
    </AdminPage>
  );
};

export default EditStoryPage;
