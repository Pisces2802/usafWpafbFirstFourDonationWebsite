import { createColumnHelper } from "@tanstack/react-table";
import { ClipboardCheck, Copy, Pencil, Trash2 } from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminCampaignRow } from "@/lib/admin/catalog-queries";
import { campaignName } from "@/lib/admin/catalog-schema";

import { createColumns, StatusCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminCampaignRow>();

type CampaignColumnOptions = {
  abilities: { edit: boolean; delete: boolean; approve: boolean };
  /** The person looking, who can't approve a campaign they created or last changed. */
  currentUserId: number;
  /** The campaign whose change is saving, so its actions wait until it finishes. */
  pendingId: number | null;
  onCopyLink: (campaign: AdminCampaignRow) => void;
  onReview: (campaign: AdminCampaignRow) => void;
  onEdit: (campaign: AdminCampaignRow) => void;
  onDelete: (campaign: AdminCampaignRow) => void;
};

/** Campaigns: name and link, status, progress towards the goal, donors, gifts and dates. */
export function createCampaignColumns(
  { t, format, money }: ColumnTools,
  {
    abilities,
    currentUserId,
    pendingId,
    onCopyLink,
    onReview,
    onEdit,
    onDelete,
  }: CampaignColumnOptions,
) {
  const date = (value: Date) =>
    format.dateTime(value, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const ratio = (campaign: AdminCampaignRow) =>
    campaign.goalCents > 0 ? campaign.raisedCents / campaign.goalCents : 0;
  const isPending = (campaign: AdminCampaignRow) => campaign.id === pendingId;
  const isMine = (campaign: AdminCampaignRow) =>
    campaign.createdById === currentUserId || campaign.requestedById === currentUserId;
  /** Whether something on it waits for someone other than the person looking to approve it. */
  const awaitsMyReview = (campaign: AdminCampaignRow) =>
    campaign.approval === "pending"
      ? !isMine(campaign)
      : campaign.proposedChange !== null && campaign.changeRequestedById !== currentUserId;
  /** The line under the status about a change to an approved campaign, if any. */
  const changeDetail = (campaign: AdminCampaignRow) => {
    if (campaign.approval !== "approved") return null;
    if (campaign.proposedChange) {
      return campaign.changeRequestedById === currentUserId
        ? t("campaigns.approval.changeWaitingForOthers")
        : t("campaigns.approval.changeAskedBy", { name: campaign.changeRequestedByName ?? "?" });
    }
    if (campaign.changeReviewNote !== null) {
      const name = campaign.changeReviewedByName ?? "?";
      return campaign.changeReviewNote
        ? t("campaigns.approval.changeRejectedWhy", { name, reason: campaign.changeReviewNote })
        : t("campaigns.approval.changeRejectedBy", { name });
    }
    return null;
  };

  return createColumns<AdminCampaignRow>({
    columns: column.columns([
      column.accessor((campaign) => campaignName(campaign.slug), {
        id: "name",
        header: t("campaigns.columns.campaign"),
        cell: (info) => (
          <span className="flex flex-col">
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-muted-foreground font-mono text-xs">
              {info.row.original.slug}
            </span>
          </span>
        ),
      }),
      // Until it's approved, where it is in approval matters more than its dates.
      column.accessor(
        (campaign) => (campaign.approval === "approved" ? campaign.status : campaign.approval),
        {
          id: "status",
          header: t("campaigns.columns.status"),
          cell: (info) => {
            const campaign = info.row.original;
            const status = info.getValue();
            const detail =
              campaign.approval === "pending"
                ? isMine(campaign)
                  ? t("campaigns.approval.waitingForOthers")
                  : t("campaigns.approval.askedBy", { name: campaign.requestedByName ?? "?" })
                : campaign.approval === "rejected"
                  ? campaign.reviewNote
                    ? t("campaigns.approval.rejectedWhy", {
                        name: campaign.reviewedByName ?? "?",
                        reason: campaign.reviewNote,
                      })
                    : t("campaigns.approval.rejectedBy", { name: campaign.reviewedByName ?? "?" })
                  : changeDetail(campaign);
            return (
              <span className="flex max-w-56 flex-col items-start gap-1">
                <StatusCell
                  status={status}
                  label={t(`campaigns.status.${status}`)}
                  config={{
                    upcoming: "info",
                    live: "success",
                    ended: "neutral",
                    pending: "warning",
                    rejected: "danger",
                  }}
                />
                {detail && <span className="text-muted-foreground text-xs">{detail}</span>}
              </span>
            );
          },
        },
      ),
      column.accessor(ratio, {
        id: "raised",
        header: t("campaigns.columns.raised"),
        cell: (info) => {
          const campaign = info.row.original;
          const value = info.getValue();
          const percent = format.number(value, { style: "percent", maximumFractionDigits: 0 });
          const name = campaignName(campaign.slug);
          return (
            <span className="flex min-w-44 flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3 tabular-nums">
                <span className="font-medium">{money(campaign.raisedCents)}</span>
                <span className="text-muted-foreground text-xs">{percent}</span>
              </span>
              <span
                role="progressbar"
                aria-label={t("campaigns.progressLabel", { name })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(Math.round(value * 100), 100)}
                aria-valuetext={percent}
                className="bg-muted block h-1.5 overflow-hidden rounded-full"
              >
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${Math.min(value, 1) * 100}%` }}
                />
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("campaigns.goal", { goal: money(campaign.goalCents) })}
              </span>
            </span>
          );
        },
      }),
      column.accessor("donorCount", {
        header: t("campaigns.columns.donors"),
        meta: { align: "right" },
        cell: (info) => format.number(info.getValue()),
      }),
      column.accessor("giftCount", {
        header: t("campaigns.columns.gifts"),
        meta: { align: "right" },
        cell: (info) => format.number(info.getValue()),
      }),
      column.accessor((campaign) => campaign.startsAt ?? campaign.endsAt, {
        id: "dates",
        header: t("campaigns.columns.dates"),
        sortFn: "datetime",
        cell: (info) => {
          const { startsAt, endsAt } = info.row.original;
          if (startsAt && endsAt) {
            return t("campaigns.dates.range", { start: date(startsAt), end: date(endsAt) });
          }
          if (startsAt) return t("campaigns.dates.from", { start: date(startsAt) });
          if (endsAt) return t("campaigns.dates.until", { end: date(endsAt) });
          return <span className="text-muted-foreground">{t("campaigns.dates.open")}</span>;
        },
      }),
    ]),
    actionsLabel: (campaign) => t("table.actionsFor", { name: campaignName(campaign.slug) }),
    actions: (campaign) => [
      {
        label: t("campaigns.review"),
        icon: ClipboardCheck,
        // Someone else approves: never whoever created it or last changed it.
        hidden: !abilities.approve || !awaitsMyReview(campaign),
        disabled: isPending,
        onClick: onReview,
      },
      {
        label: t("campaigns.copyLink"),
        icon: Copy,
        // The link only works once it's approved.
        hidden: campaign.approval !== "approved",
        onClick: onCopyLink,
      },
      {
        label: t("campaigns.edit"),
        icon: Pencil,
        hidden: !abilities.edit,
        disabled: isPending,
        onClick: onEdit,
      },
      {
        label: t("campaigns.delete"),
        icon: Trash2,
        variant: "destructive",
        // Campaigns with gifts stay, so the gifts keep their campaign.
        hidden: !abilities.delete || campaign.giftCount > 0,
        disabled: isPending,
        onClick: onDelete,
      },
    ],
  });
}
