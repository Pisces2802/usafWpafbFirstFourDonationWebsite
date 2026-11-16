"use client";

import { Flag, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CampaignFormDialog, type CampaignSaved } from "@/components/admin/campaign-form-dialog";
import { CatalogNotice } from "@/components/admin/catalog-notice";
import { DataTable } from "@/components/admin/data-table";
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
import { createCampaignColumns } from "@/config/columns/campaign";
import { useCatalogAction } from "@/hooks/use-catalog-action";
import { useColumnTools } from "@/hooks/use-column-tools";
import { deleteCampaign } from "@/lib/admin/catalog-actions";
import { CampaignReviewDialog } from "@/components/admin/campaign-review-dialog";
import type { AdminCampaignRow } from "@/lib/admin/catalog-queries";
import { campaignName } from "@/lib/admin/catalog-schema";

type Editing = { campaign: AdminCampaignRow | null } | null;

/** Every campaign in a table with its progress, link and actions, plus the create and edit form. */
export const CampaignsBoard = ({
  campaigns,
  abilities,
  currentUserId,
}: {
  campaigns: AdminCampaignRow[];
  /** What the signed-in person's role allows; the server actions check again. */
  abilities: { create: boolean; edit: boolean; delete: boolean; approve: boolean };
  /** The person looking, who can't approve their own campaigns. */
  currentUserId: number;
}) => {
  const t = useTranslations("Admin.campaigns");
  const action = useCatalogAction();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminCampaignRow | null>(null);
  const [reviewing, setReviewing] = useState<AdminCampaignRow | null>(null);
  const tools = useColumnTools();
  const locale = useLocale();
  const pending = action.pendingKey === null ? null : Number(action.pendingKey);

  const columns = createCampaignColumns(tools, {
    abilities,
    currentUserId,
    pendingId: pending,
    onReview: (campaign) => {
      action.setNotice(null);
      setReviewing(campaign);
    },
    onCopyLink: async (campaign) => {
      const name = campaignName(campaign.slug);
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}/${locale}/donate?campaign=${campaign.slug}`,
        );
        action.setNotice({ kind: "success", message: t("notices.copied", { name }) });
      } catch {
        action.setNotice({ kind: "error", error: "unknown" });
      }
    },
    onEdit: (campaign) => {
      action.setNotice(null);
      setEditing({ campaign });
    },
    onDelete: setDeleting,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CatalogNotice notice={action.notice} />
        {abilities.create && (
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
        )}
      </div>

      {campaigns.length ? (
        <DataTable
          columns={columns}
          data={campaigns}
          getRowId={(campaign) => String(campaign.id)}
          caption={(count) => tools.t("rowCount", { count })}
        />
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
        onSaved={(slug, outcome: CampaignSaved) => {
          setEditing(null);
          const key = {
            created: "notices.created",
            new: "notices.resubmitted",
            change: "notices.changeRequested",
            none: "notices.updated",
          }[outcome];
          action.setNotice({
            kind: "success",
            message: t(key as "notices.created", { name: campaignName(slug) }),
          });
        }}
      />

      <CampaignReviewDialog
        campaign={reviewing}
        onClose={() => setReviewing(null)}
        onReview={(campaign, run, message) => {
          setReviewing(null);
          action.run(String(campaign.id), run, message);
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
