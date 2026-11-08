"use client";

import {
  CalendarDays,
  Check,
  Copy,
  Flag,
  HeartHandshake,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CampaignFormDialog } from "@/components/admin/campaign-form-dialog";
import { CatalogNotice } from "@/components/admin/catalog-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogAction } from "@/hooks/use-catalog-action";
import { useCopy } from "@/hooks/use-copy";
import { deleteCampaign } from "@/lib/admin/catalog-actions";
import type { AdminCampaignRow, CampaignStatus } from "@/lib/admin/catalog-queries";
import { campaignName } from "@/lib/admin/catalog-schema";
import { MONEY_FORMAT } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<CampaignStatus, string> = {
  upcoming: "bg-accent text-primary",
  live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ended: "bg-muted text-muted-foreground",
};

const CopyLinkButton = ({ slug }: { slug: string }) => {
  const t = useTranslations("Admin.campaigns");
  const locale = useLocale();
  const { copied, copy } = useCopy();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={t("copyLinkFor", { name: campaignName(slug) })}
      onClick={() => copy(`${window.location.origin}/${locale}/donate?campaign=${slug}`)}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? t("copied") : t("copyLink")}
    </Button>
  );
};

type CampaignCardProps = {
  campaign: AdminCampaignRow;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const CampaignCard = ({ campaign, isPending, onEdit, onDelete }: CampaignCardProps) => {
  const t = useTranslations("Admin.campaigns");
  const format = useFormatter();
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);
  const date = (value: Date) =>
    format.dateTime(value, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  const name = campaignName(campaign.slug);
  const { status } = campaign;
  const ratio = campaign.goalCents > 0 ? campaign.raisedCents / campaign.goalCents : 0;
  const percent = format.number(ratio, { style: "percent", maximumFractionDigits: 0 });
  const headingId = `campaign-${campaign.id}`;

  const dates =
    campaign.startsAt && campaign.endsAt
      ? t("dates.range", { start: date(campaign.startsAt), end: date(campaign.endsAt) })
      : campaign.startsAt
        ? t("dates.from", { start: date(campaign.startsAt) })
        : campaign.endsAt
          ? t("dates.until", { end: date(campaign.endsAt) })
          : t("dates.open");

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "bg-card ring-foreground/10 flex flex-col gap-5 rounded-2xl p-5 ring-1",
        isPending && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Flag aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-lg font-semibold">
              {name}
            </h2>
            <p className="text-muted-foreground truncate font-mono text-xs">{campaign.slug}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            STATUS_STYLES[status],
          )}
        >
          {t(`status.${status}`)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-condensed text-3xl leading-tight tabular-nums">
            {money(campaign.raisedCents)}
          </p>
          <p className="text-sm font-semibold tabular-nums">{percent}</p>
        </div>
        <div
          role="progressbar"
          aria-label={t("progressLabel", { name })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(Math.round(ratio * 100), 100)}
          aria-valuetext={percent}
          className="bg-muted h-2 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${Math.min(ratio, 1) * 100}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("goal", { goal: money(campaign.goalCents) })}
        </p>
      </div>

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt>
            <Users aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("donors")}</span>
          </dt>
          <dd>{t("donorCount", { count: campaign.donorCount })}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>
            <HeartHandshake aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("gifts")}</span>
          </dt>
          <dd>{t("giftCount", { count: campaign.giftCount })}</dd>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <dt>
            <CalendarDays aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("datesLabel")}</span>
          </dt>
          <dd>{dates}</dd>
        </div>
      </dl>

      <div className="border-border mt-auto flex flex-wrap gap-2 border-t pt-4">
        <CopyLinkButton slug={campaign.slug} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          aria-label={t("editFor", { name })}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" />
          {t("edit")}
        </Button>
        {campaign.giftCount === 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-label={t("deleteFor", { name })}
            className="text-destructive hover:text-destructive ml-auto"
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
            {t("delete")}
          </Button>
        )}
      </div>
    </li>
  );
};

type Editing = { campaign: AdminCampaignRow | null } | null;

/** Every campaign as a card with its progress, link and actions, plus the create and edit form. */
export const CampaignsBoard = ({ campaigns }: { campaigns: AdminCampaignRow[] }) => {
  const t = useTranslations("Admin.campaigns");
  const action = useCatalogAction();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminCampaignRow | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CatalogNotice notice={action.notice} />
        <Button
          type="button"
          size="touch"
          className="ml-auto"
          onClick={() => {
            action.setNotice(null);
            setEditing({ campaign: null });
          }}
        >
          <Plus aria-hidden="true" />
          {t("new")}
        </Button>
      </div>

      {campaigns.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isPending={action.pendingKey === String(campaign.id)}
              onEdit={() => {
                action.setNotice(null);
                setEditing({ campaign });
              }}
              onDelete={() => setDeleting(campaign)}
            />
          ))}
        </ul>
      ) : (
        <div className="bg-card ring-foreground/10 flex flex-col items-center gap-3 rounded-2xl p-10 text-center ring-1">
          <span className="bg-accent text-primary flex size-12 items-center justify-center rounded-full">
            <Flag aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground max-w-md">{t("emptyBody")}</p>
        </div>
      )}

      <CampaignFormDialog
        open={editing !== null}
        campaign={editing?.campaign ?? null}
        onClose={() => setEditing(null)}
        onSaved={(slug, isNew) => {
          setEditing(null);
          action.setNotice({
            kind: "success",
            message: t(isNew ? "notices.created" : "notices.updated", { name: campaignName(slug) }),
          });
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent closeLabel={t("form.close")} className="gap-5 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {t("deleteDialog.title", { name: campaignName(deleting?.slug ?? "") })}
            </DialogTitle>
            <DialogDescription>{t("deleteDialog.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
              {t("form.cancel")}
            </DialogClose>
            <Button
              type="button"
              size="touch"
              variant="destructive"
              onClick={() => {
                if (!deleting) return;
                const target = deleting;
                setDeleting(null);
                action.run(
                  String(target.id),
                  () => deleteCampaign(target.id),
                  t("notices.deleted", { name: campaignName(target.slug) }),
                );
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
