import { getLocale, getTranslations } from "next-intl/server";

import { ActionBand } from "@/components/layout/action-band";
import { PageHeader } from "@/components/layout/page-header";
import { StoryCard } from "@/components/stories/story-card";
import type { Locale } from "@/i18n/routing";
import { getPageMetadata } from "@/lib/metadata";
import { getPublishedStories } from "@/lib/stories/queries";

export const generateMetadata = ({ params }: PageProps<"/[locale]/stories">) =>
  getPageMetadata(params, {
    titleKey: "stories",
    href: "/stories",
    description: async (locale) =>
      (await getTranslations({ locale, namespace: "Stories" }))("lead"),
  });

const StoriesPage = async () => {
  const t = await getTranslations("Stories");
  const tAbout = await getTranslations("About");
  const stories = await getPublishedStories((await getLocale()) as Locale);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <section
        aria-label={t("title")}
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24"
      >
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <li key={story.slug} className="flex">
              <StoryCard story={story} />
            </li>
          ))}
        </ul>
      </section>

      <ActionBand id="stories-action" title={tAbout("ctaHeading")} body={tAbout("ctaBody")} />
    </>
  );
};

export default StoriesPage;
