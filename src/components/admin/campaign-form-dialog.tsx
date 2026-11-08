"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/admin/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCampaign, updateCampaign } from "@/lib/admin/catalog-actions";
import type { AdminCampaignRow } from "@/lib/admin/catalog-queries";
import {
  CAMPAIGN_FIELDS,
  type CampaignInput,
  campaignSchema,
  type CampaignValues,
  type CatalogError,
  toDateInput,
  startOfDay as toDate,
} from "@/lib/admin/catalog-schema";

type Field = (typeof CAMPAIGN_FIELDS)[number];

const EMPTY: CampaignInput = { slug: "", goal: "", startsOn: "", endsOn: "" };

const toInput = (campaign: AdminCampaignRow): CampaignInput => ({
  slug: campaign.slug,
  goal: String(campaign.goalCents / 100),
  startsOn: toDateInput(campaign.startsAt),
  endsOn: toDateInput(campaign.endsAt),
});

type CampaignFormProps = {
  campaign: AdminCampaignRow | null;
  onSaved: (slug: string, isNew: boolean) => void;
};

/** The form itself. It's keyed by campaign, so it starts fresh each time the dialog opens. */
const CampaignForm = ({ campaign, onSaved }: CampaignFormProps) => {
  const t = useTranslations("Admin.campaigns");
  const tErrors = useTranslations("Admin.catalog.errors");
  const [error, setError] = useState<CatalogError | "unknown" | null>(null);
  const form = useForm<CampaignInput, unknown, CampaignValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign ? toInput(campaign) : EMPTY,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const slugLocked = campaign !== null && campaign.giftCount > 0;
  form.register("startsOn");
  form.register("endsOn");
  const startsOn = form.watch("startsOn");
  const endsOn = form.watch("endsOn");

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const input: CampaignInput = {
      slug: values.slug,
      goal: String(values.goal / 100),
      startsOn: values.startsOn,
      endsOn: values.endsOn,
    };
    try {
      const result = campaign
        ? await updateCampaign(campaign.id, input)
        : await createCampaign(input);
      if (result.ok) {
        onSaved(values.slug, campaign === null);
      } else if (result.error === "slugTaken" || result.error === "hasGifts") {
        form.setError("slug", { type: result.error }, { shouldFocus: true });
      } else {
        setError(result.error);
      }
    } catch {
      setError("unknown");
    }
  });

  const message = (field: Field) => {
    const fieldError = form.formState.errors[field];
    if (!fieldError) return undefined;
    if (fieldError.type === "slugTaken") return tErrors("slugTaken");
    if (fieldError.type === "hasGifts") return tErrors("hasGifts");
    if (field === "endsOn" && fieldError.message === "endsBeforeStart") {
      return t("form.errors.endsBeforeStart");
    }
    return t(`form.errors.${field}`);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <TextField
        id="campaign-slug"
        label={t("form.slug")}
        hint={slugLocked ? t("form.slugLocked") : t("form.slugHint")}
        autoComplete="off"
        spellCheck={false}
        readOnly={slugLocked}
        error={message("slug")}
        {...form.register("slug")}
      />
      <TextField
        id="campaign-goal"
        label={t("form.goal")}
        inputMode="decimal"
        autoComplete="off"
        placeholder="5000"
        error={message("goal")}
        {...form.register("goal")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <DatePicker
          type="single"
          label={t("form.startsOn")}
          value={toDate(startsOn) ?? undefined}
          onValueChange={(d) =>
            form.setValue("startsOn", d ? toDateInput(d) : "", { shouldValidate: true })
          }
          maxDate={toDate(endsOn) ?? undefined}
          error={!!message("startsOn")}
          clearable
        />
        <DatePicker
          type="single"
          label={t("form.endsOn")}
          value={toDate(endsOn) ?? undefined}
          onValueChange={(d) =>
            form.setValue("endsOn", d ? toDateInput(d) : "", { shouldValidate: true })
          }
          minDate={toDate(startsOn) ?? undefined}
          error={!!message("endsOn")}
          clearable
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">{t("form.datesHint")}</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(error)}
        </p>
      )}
      <DialogFooter className="-mx-5 -mb-5 p-5">
        <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
          {t("form.cancel")}
        </DialogClose>
        <Button type="submit" size="touch" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? t("form.saving")
            : campaign
              ? t("form.save")
              : t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
};

type CampaignFormDialogProps = CampaignFormProps & {
  open: boolean;
  onClose: () => void;
};

/** Create or edit a campaign: its link name, goal and optional start and end dates. */
export const CampaignFormDialog = ({
  open,
  campaign,
  onClose,
  onSaved,
}: CampaignFormDialogProps) => {
  const t = useTranslations("Admin.campaigns");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={t("form.close")} className="gap-5 p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {campaign ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>
        {open && <CampaignForm key={campaign?.id ?? "new"} campaign={campaign} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
};
