"use client";

import {
  BookOpenText,
  CircleCheck,
  ExternalLink,
  Pencil,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isFundId } from "@/config/donation";
import { deleteStory } from "@/lib/admin/story-actions";
import type { AdminStoryRow } from "@/lib/admin/story-queries";
import { STORY_LOCALES, type StoryError, type StoryStatus } from "@/lib/stories/story-schema";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<StoryStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

type Notice =
  { kind: "success"; message: string } | { kind: "error"; error: StoryError | "unknown" };

const StoryRow = ({
  story,
  isPending,
  onDelete,
}: {
  story: AdminStoryRow;
  isPending: boolean;
  onDelete: () => void;
}) => {
  const t = useTranslations("Admin.stories");
  const tFunds = useTranslations("Funds");
  const format = useFormatter();
  const title = story.title || t("untitled");
  const headingId = `story-${story.id}`;

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "bg-card ring-foreground/10 flex flex-col gap-4 rounded-2xl p-5 ring-1 sm:flex-row sm:items-center",
        isPending && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              STATUS_STYLES[story.status],
            )}
          >
            {t(`status.${story.status}`)}
          </span>
          {story.isFeatured && (
            <span className="bg-accent text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              <Star aria-hidden="true" className="size-3" />
              {t("featured")}
            </span>
          )}
          {story.isSample && (
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {t("sample")}
            </span>
          )}
        </div>
        <h2 id={headingId} className="text-lg leading-snug font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <span>{story.name}</span>
          {isFundId(story.fundId) && <span>{tFunds(`${story.fundId}.name`)}</span>}
          <span>
            {t("dated", {
              date: format.dateTime(new Date(`${story.publishedOn}T00:00:00Z`), {
                dateStyle: "medium",
                timeZone: "UTC",
              }),
            })}
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-xs">
          <span className="sr-only">{t("languagesLabel")}:</span>
          {STORY_LOCALES.map((locale) => (
            <span
              key={locale}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono font-semibold uppercase",
                story.locales.includes(locale)
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground line-through",
              )}
            >
              {locale}
            </span>
          ))}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Link
          href={`/admin/stories/${story.id}`}
          aria-label={t("editFor", { title })}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Pencil aria-hidden="true" />
          {t("edit")}
        </Link>
        {story.status === "published" && (
          <a
            href={`/en/stories/${story.slug}`}
            target="_blank"
            rel="noreferrer"
            aria-label={t("viewFor", { title })}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink aria-hidden="true" />
            {t("view")}
          </a>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={t("deleteFor", { title })}
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </Button>
      </div>
    </li>
  );
};

/** Every story with its status and languages, and links to write, edit or delete one. */
export const StoriesBoard = ({ stories }: { stories: AdminStoryRow[] }) => {
  const t = useTranslations("Admin.stories");
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<AdminStoryRow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(() => {
    const saved = stories.find((story) => String(story.id) === searchParams.get("saved"));
    if (!saved) return null;
    const key = searchParams.has("new") ? "notices.created" : "notices.updated";
    return { kind: "success", message: t(key, { title: saved.title }) };
  });

  const remove = (story: AdminStoryRow) => {
    setPendingId(story.id);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await deleteStory(story.id);
        setNotice(
          result.ok
            ? { kind: "success", message: t("notices.deleted", { title: story.title }) }
            : { kind: "error", error: result.error },
        );
      } catch {
        setNotice({ kind: "error", error: "unknown" });
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-live="polite" className="empty:hidden">
          {notice?.kind === "error" && (
            <p role="alert" className="text-destructive inline-flex items-center gap-2 text-sm">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {t(`errors.${notice.error}`)}
            </p>
          )}
          {notice?.kind === "success" && (
            <p role="status" className="inline-flex items-center gap-2 text-sm">
              <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
              {notice.message}
            </p>
          )}
        </div>
        <Link
          href="/admin/stories/new"
          className={cn(buttonVariants({ size: "touch" }), "ml-auto")}
        >
          <Plus aria-hidden="true" />
          {t("new")}
        </Link>
      </div>

      {stories.length ? (
        <ul className="flex flex-col gap-3">
          {stories.map((story) => (
            <StoryRow
              key={story.id}
              story={story}
              isPending={isPending && pendingId === story.id}
              onDelete={() => setDeleting(story)}
            />
          ))}
        </ul>
      ) : (
        <div className="bg-card ring-foreground/10 flex flex-col items-center gap-3 rounded-2xl p-10 text-center ring-1">
          <span className="bg-accent text-primary flex size-12 items-center justify-center rounded-full">
            <BookOpenText aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground max-w-md">{t("emptyBody")}</p>
        </div>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent closeLabel={t("deleteDialog.close")} className="gap-5 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {t("deleteDialog.title", { title: deleting?.title ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("deleteDialog.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
              {t("deleteDialog.cancel")}
            </DialogClose>
            <Button
              type="button"
              size="touch"
              variant="destructive"
              onClick={() => {
                if (!deleting) return;
                const target = deleting;
                setDeleting(null);
                remove(target);
              }}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
