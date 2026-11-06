import { getTranslations } from "next-intl/server";

import { SampleBadge } from "@/components/stories/sample-badge";
import { StoryPortrait } from "@/components/stories/story-portrait";
import { buttonVariants } from "@/components/ui/button";
import { featuredStorySlug, getStory } from "@/config/stories";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const FeaturedStory = async () => {
  const story = getStory(featuredStorySlug);
  if (!story) return null;

  const t = await getTranslations("Stories");
  const name = t(`items.${story.slug}.name`);

  return (
    <section
      aria-labelledby="featured-story-heading"
      className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-8 lg:pb-28"
    >
      <h2 id="featured-story-heading" className="headline text-4xl md:text-5xl">
        {t("featuredHeading")}
      </h2>

      <figure className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
        <StoryPortrait name={name} />
        <div>
          {story.isSample && <SampleBadge label={t("sampleBadge")} />}
          <blockquote className="font-condensed mt-4 text-3xl leading-tight md:text-4xl">
            <p>
              <q>{t(`items.${story.slug}.quote`)}</q>
            </p>
          </blockquote>
          <figcaption className="mt-6 text-lg">
            <span className="font-semibold">{name}</span>
            <span className="text-muted-foreground">, {t(`items.${story.slug}.role`)}</span>
          </figcaption>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={{ pathname: "/stories/[slug]", params: { slug: story.slug } }}
              className={buttonVariants({ size: "touch" })}
            >
              {t("readStory", { name })}
            </Link>
            <Link
              href="/stories"
              className={cn(buttonVariants({ variant: "outline", size: "touch" }))}
            >
              {t("backToStories")}
            </Link>
          </div>
        </div>
      </figure>
    </section>
  );
};
