"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { TextField } from "@/components/donation/text-field";
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
import { approveCampaign, rejectCampaign } from "@/lib/admin/catalog-actions";
import type { AdminCampaignRow } from "@/lib/admin/catalog-queries";
import { campaignName, type CatalogResult } from "@/lib/admin/catalog-schema";
import { MONEY_FORMAT } from "@/lib/money";

type CampaignReviewDialogProps = {
  campaign: AdminCampaignRow | null;
  onClose: () => void;
  /** Runs the decision through the board, which shows how it went. */
  onReview: (
    campaign: AdminCampaignRow,
    run: () => Promise<CatalogResult>,
    message: string,
  ) => void;
};

type Version = {
  slug: string;
  goalCents: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
};

/**
 * The second person's check on what's waiting: a new campaign (approving puts it on the site) or
 * a change to an approved one (approving applies it), shown next to what's live now. Either can
 * be turned down with an optional reason. The server refuses whoever asked, and refuses if it
 * changed after this opened, so what's approved is what was shown here.
 */
export const CampaignReviewDialog = ({
  campaign,
  onClose,
  onReview,
}: CampaignReviewDialogProps) => {
  const t = useTranslations("Admin.campaigns");
  const format = useFormatter();
  const [note, setNote] = useState("");
  const change = campaign?.approval === "approved" ? campaign.proposedChange : null;
  const name = campaignName(campaign?.slug ?? "");

  const day = (value: Date | string) =>
    format.dateTime(new Date(value), {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  const dates = ({ startsAt, endsAt }: Version) =>
    startsAt && endsAt
      ? t("dates.range", { start: day(startsAt), end: day(endsAt) })
      : startsAt
        ? t("dates.from", { start: day(startsAt) })
        : endsAt
          ? t("dates.until", { end: day(endsAt) })
          : t("dates.open");
  const fields = (version: Version) => ({
    link: version.slug,
    goal: format.number(version.goalCents / 100, MONEY_FORMAT),
    dates: dates(version),
  });

  const live = campaign ? fields(campaign) : null;
  const proposed = change ? fields(change) : null;
  const askedBy = (change ? campaign?.changeRequestedByName : campaign?.requestedByName) ?? "?";
  const seenAt = (change ? campaign?.changeRequestedAt : campaign?.requestedAt) ?? null;

  const close = () => {
    setNote("");
    onClose();
  };
  const decide = (approve: boolean) => {
    if (!campaign) return;
    const reason = note.trim();
    const seen = seenAt ? new Date(seenAt).toISOString() : null;
    setNote("");
    const key = change
      ? approve
        ? "notices.changeApproved"
        : "notices.changeRejected"
      : approve
        ? "notices.approved"
        : "notices.rejected";
    onReview(
      campaign,
      () =>
        approve ? approveCampaign(campaign.id, seen) : rejectCampaign(campaign.id, seen, reason),
      t(key, { name }),
    );
  };

  const rows = (["link", "goal", "dates"] as const).map((field) => ({
    field,
    now: live?.[field] ?? "",
    next: proposed?.[field],
  }));

  return (
    <Dialog open={campaign !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent closeLabel={t("form.close")} className="gap-5 p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t(change ? "reviewDialog.changeTitle" : "reviewDialog.title", { name })}
          </DialogTitle>
          <DialogDescription>
            {t(change ? "reviewDialog.changeBody" : "reviewDialog.body")}
          </DialogDescription>
        </DialogHeader>
        {campaign && change ? (
          <table className="bg-muted w-full rounded-lg text-sm">
            <caption className="sr-only">{t("reviewDialog.changeTitle", { name })}</caption>
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th scope="col" className="p-3 pb-1 font-medium">
                  <span className="sr-only">{t("reviewDialog.field")}</span>
                </th>
                <th scope="col" className="p-3 pb-1 font-medium">
                  {t("reviewDialog.now")}
                </th>
                <th scope="col" className="p-3 pb-1 font-medium">
                  {t("reviewDialog.proposed")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ field, now, next }) => {
                const changed = next !== now;
                const mono = field === "link" ? "font-mono break-all " : "";
                return (
                  <tr key={field} className="align-top">
                    <th
                      scope="row"
                      className="text-muted-foreground px-3 py-1.5 text-left font-normal"
                    >
                      {t(`reviewDialog.${field}`)}
                    </th>
                    <td className={`${mono}px-3 py-1.5`}>{now}</td>
                    <td
                      className={
                        changed
                          ? `${mono}px-3 py-1.5 font-semibold`
                          : "text-muted-foreground px-3 py-1.5"
                      }
                    >
                      {changed ? next : t("reviewDialog.unchanged")}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <th
                  scope="row"
                  className="text-muted-foreground px-3 pt-1.5 pb-3 text-left font-normal"
                >
                  {t("reviewDialog.askedBy")}
                </th>
                <td colSpan={2} className="px-3 pt-1.5 pb-3">
                  {askedBy}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          live && (
            <dl className="bg-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg p-3 text-sm">
              <dt className="text-muted-foreground">{t("reviewDialog.link")}</dt>
              <dd className="font-mono break-all">{live.link}</dd>
              <dt className="text-muted-foreground">{t("reviewDialog.goal")}</dt>
              <dd className="tabular-nums">{live.goal}</dd>
              <dt className="text-muted-foreground">{t("reviewDialog.dates")}</dt>
              <dd>{live.dates}</dd>
              <dt className="text-muted-foreground">{t("reviewDialog.askedBy")}</dt>
              <dd>{askedBy}</dd>
            </dl>
          )
        )}
        <TextField
          id="campaign-review-note"
          label={t("reviewDialog.note")}
          hint={t("reviewDialog.noteHint")}
          maxLength={300}
          autoComplete="off"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <DialogFooter className="-mx-5 -mb-5 p-5">
          <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
            {t("form.cancel")}
          </DialogClose>
          <Button type="button" size="touch" variant="destructive" onClick={() => decide(false)}>
            {t("reviewDialog.reject")}
          </Button>
          <Button type="button" size="touch" onClick={() => decide(true)}>
            {t("reviewDialog.approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
