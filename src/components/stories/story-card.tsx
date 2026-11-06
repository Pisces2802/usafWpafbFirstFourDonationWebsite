import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SampleBadge } from "@/components/stories/sample-badge";
import { StoryPortrait } from "@/components/stories/story-portrait";
import type { StoryEntry } from "@/config/stories";
import { Link } from "@/i18n/navigation";

type StoryCardProps = {
  story: StoryEntry;
  headingLevel?: "h2" | "h3";
};

export const StoryCard = async ({ story, headingLevel: Heading = "h2" }: StoryCardProps) => {
  const t = await getTranslations("Stories");
  const tFunds = await getTranslations("Funds");
  const item = (key: "name" | "title" | "summary") => t(`items.${story.slug}.${key}`);

  return (
    <article className="group/story bg-card text-card-foreground ring-foreground/10 has-focus-visible:outline-ring hover:ring-primary/60 relative flex flex-col rounded-xl p-3 ring-1 transition-shadow duration-200 has-focus-visible:outline-3 has-focus-visible:outline-offset-2">
      <StoryPortrait name={item("name")} />
      <div className="flex flex-1 flex-col p-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-primary text-sm font-semibold">
            {tFunds(`${story.fundId}.name`)}
          </span>
          {story.isSample && <SampleBadge label={t("sampleBadge")} />}
        </div>
        <Heading className="font-condensed mt-3 text-2xl leading-tight">{item("title")}</Heading>
        <p className="text-muted-foreground mt-3 flex-1">{item("summary")}</p>
        <Link
          href={{ pathname: "/stories/[slug]", params: { slug: story.slug } }}
          className="text-primary mt-6 inline-flex min-h-11 items-center gap-2 font-semibold outline-none after:absolute after:inset-0 after:rounded-xl"
        >
          {t("readStory", { name: item("name") })}
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover/story:translate-x-1"
          />
        </Link>
      </div>
    </article>
  );
};
