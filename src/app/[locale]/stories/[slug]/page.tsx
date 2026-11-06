import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { SampleBadge } from "@/components/stories/sample-badge";
import { StoryCard } from "@/components/stories/story-card";
import { StoryPortrait } from "@/components/stories/story-portrait";
import { buttonVariants } from "@/components/ui/button";
import { getStory, stories } from "@/config/stories";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

type StoryPageProps = PageProps<"/[locale]/stories/[slug]">;

export const generateStaticParams = () => stories.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({ params }: StoryPageProps): Promise<Metadata> => {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const story = getStory(slug);
  if (!story) return {};

  const t = await getTranslations({ locale, namespace: "Stories" });
  return buildPageMetadata({
    locale,
    href: { pathname: "/stories/[slug]", params: { slug } },
    title: t(`items.${story.slug}.title`),
    description: t(`items.${story.slug}.summary`),
  });
};

const StoryPage = async ({ params }: StoryPageProps) => {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const story = getStory(slug);
  if (!story) notFound();

  const t = await getTranslations("Stories");
  const tFunds = await getTranslations("Funds");
  const format = await getFormatter();
  const { default: Body } = await story.body[locale]();
  const name = t(`items.${story.slug}.name`);
  const fund = tFunds(`${story.fundId}.name`);
  const otherStories = stories.filter((other) => other.slug !== story.slug);

  return (
    <>
      <article className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8 lg:py-16">
        <Link
          href="/stories"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 font-medium transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("backToStories")}
        </Link>

        <header className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-primary font-semibold">{fund}</span>
              {story.isSample && <SampleBadge label={t("sampleBadge")} />}
            </div>
            <h1 className="headline mt-4 text-4xl sm:text-5xl lg:text-6xl">
              {t(`items.${story.slug}.title`)}
            </h1>
            <p className="mt-6 text-xl">
              <span className="font-semibold">{name}</span>
              <span className="text-muted-foreground">, {t(`items.${story.slug}.role`)}</span>
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("publishedOn", {
                date: format.dateTime(new Date(story.publishedAt), { dateStyle: "long" }),
              })}
            </p>
          </div>
          <StoryPortrait name={name} />
        </header>

        {story.isSample && (
          <p className="bg-muted text-muted-foreground mt-10 max-w-[65ch] rounded-lg p-4 text-sm">
            {t("sampleNotice")}
          </p>
        )}

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="max-w-[65ch] min-w-0">
            <Body />
          </div>
          <aside className="lg:pt-2">
            <div className="bg-card ring-foreground/10 rounded-xl p-6 ring-1 lg:sticky lg:top-28">
              <p className="font-condensed text-2xl leading-tight">{fund}</p>
              <p className="text-muted-foreground mt-2">{tFunds(`${story.fundId}.description`)}</p>
              <Link
                href={{ pathname: "/donate", query: { fund: story.fundId } }}
                className={cn(
                  buttonVariants({ variant: "donate", size: "touch" }),
                  "mt-6 h-auto min-h-11 w-full py-2 text-center whitespace-normal",
                )}
              >
                {t("giveToFund", { fund })}
              </Link>
            </div>
          </aside>
        </div>
      </article>

      <section aria-labelledby="more-stories-heading" className="bg-muted/60 border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-20">
          <h2 id="more-stories-heading" className="headline text-4xl">
            {t("moreStories")}
          </h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {otherStories.map((other) => (
              <li key={other.slug} className="flex">
                <StoryCard story={other} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
};

export default StoryPage;
