"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "@/lib/zod";

import { FUND_IDS } from "@/config/donation";
import { type Db, getDb } from "@/db";
import { type AdminUser, requireAdmin } from "@/lib/admin/access";
import { type AuditDetails, recordAudit } from "@/lib/admin/audit";
import {
  createCampaign as insertCampaign,
  deleteCampaign as removeCampaign,
  findCampaign,
  listFunds,
  reviewCampaign,
  saveFundOrder,
  setFundActive,
  type CampaignRecord,
  type CampaignSave,
  updateCampaign as saveCampaign,
} from "@/lib/admin/catalog-queries";
import {
  campaignSchema,
  type CatalogError,
  type CatalogResult,
  reviewNoteSchema,
  endOfDay,
  fundOrderSchema,
  startOfDay,
  toDateInput,
} from "@/lib/admin/catalog-schema";
import type { AdminPermission } from "@/lib/admin/permissions";
import { CAMPAIGN_PROGRESS_TAG } from "@/lib/campaign-progress";
import { FUND_SETTINGS_TAG } from "@/lib/fund-settings";

const idSchema = z.number().int().positive();

/**
 * Runs a campaign or fund change. Inputs come straight from the client, so each action re-checks
 * the permission and validates every argument before touching the database. On success the
 * admin page re-renders and the public pages that cache this data are refreshed.
 */
const catalogChange = async <TResult extends { ok: true } | { ok: false; error: CatalogError }>(
  permission: AdminPermission,
  tag: string,
  run: (db: Db, actor: AdminUser) => Promise<TResult>,
): Promise<TResult | { ok: false; error: "noDatabase" }> => {
  const actor = await requireAdmin(permission);
  const db = getDb();
  if (!db) return { ok: false, error: "noDatabase" };

  const result = await run(db, actor);
  if (result.ok) {
    updateTag(tag);
    refresh();
  }
  return result;
};

const toRecord = (values: z.output<typeof campaignSchema>) => ({
  slug: values.slug,
  goalCents: values.goal,
  startsAt: startOfDay(values.startsOn),
  endsAt: endOfDay(values.endsOn),
});

export const createCampaign = async (input: unknown): Promise<CatalogResult> => {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const record = toRecord(parsed.data);
  return catalogChange("campaigns:create", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
    const result = await insertCampaign(db, record, actor.id);
    if (result.ok) {
      await recordAudit(db, {
        actor,
        action: "campaign.created",
        target: record.slug,
        details: { goal: record.goalCents / 100, approval: "pending" },
      });
    }
    return result;
  });
};

/** What differs between two versions of a campaign, for the audit log. */
const campaignChanges = (before: CampaignRecord, after: CampaignRecord): AuditDetails => {
  const changes: AuditDetails = {};
  if (before.slug !== after.slug) changes.slug = after.slug;
  if (before.goalCents !== after.goalCents) changes.goal = after.goalCents / 100;
  if (toDateInput(before.startsAt) !== toDateInput(after.startsAt)) {
    changes.startsOn = toDateInput(after.startsAt) || null;
  }
  if (toDateInput(before.endsAt) !== toDateInput(after.endsAt)) {
    changes.endsOn = toDateInput(after.endsAt) || null;
  }
  return changes;
};

/**
 * Saves a campaign. Once it's approved, the change waits for someone else to approve it and the
 * campaign stays as it is on the site; `asked` says which happened.
 */
export const updateCampaign = async (id: unknown, input: unknown): Promise<CampaignSave> => {
  const parsedId = idSchema.safeParse(id);
  const parsed = campaignSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { ok: false, error: "invalid" };
  const record = toRecord(parsed.data);
  return catalogChange("campaigns:edit", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
    const before = await findCampaign(db, parsedId.data);
    const result = await saveCampaign(db, parsedId.data, record, actor.id);
    if (!result.ok || !before) return result;

    const changes = campaignChanges(before, record);
    if (result.asked === "change") {
      await recordAudit(db, {
        actor,
        action: "campaign.change_requested",
        target: before.slug,
        details: changes,
      });
    } else if (result.asked === "new") {
      await recordAudit(db, {
        actor,
        action: "campaign.updated",
        target: before.slug,
        details: { ...changes, approval: "pending" },
      });
    } else if (before.proposedChange) {
      await recordAudit(db, { actor, action: "campaign.change_withdrawn", target: before.slug });
    }
    return result;
  });
};

const seenSchema = z.iso.datetime({ offset: true }).nullable();

/**
 * Approves what's waiting on a campaign: a new campaign (it goes on the site) or a change to an
 * approved one (it's applied). Needs `campaigns:approve`; whoever asked can't approve it, and
 * `seenAt` (when the version the reviewer looked at was asked for) must still be current.
 */
export const approveCampaign = async (id: unknown, seenAt: unknown): Promise<CatalogResult> =>
  review(id, seenAt, true, null);

/** Turns down what's waiting, with a note for whoever asked. They can change it and ask again. */
export const rejectCampaign = async (
  id: unknown,
  seenAt: unknown,
  note: unknown,
): Promise<CatalogResult> => {
  const parsedNote = reviewNoteSchema.safeParse(note ?? "");
  if (!parsedNote.success) return { ok: false, error: "invalid" };
  return review(id, seenAt, false, parsedNote.data || null);
};

const review = async (
  id: unknown,
  seenAt: unknown,
  approve: boolean,
  note: string | null,
): Promise<CatalogResult> => {
  const parsedId = idSchema.safeParse(id);
  const parsedSeen = seenSchema.safeParse(seenAt);
  if (!parsedId.success || !parsedSeen.success) return { ok: false, error: "invalid" };
  const seen = parsedSeen.data ? new Date(parsedSeen.data) : null;
  return catalogChange("campaigns:approve", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
    const before = await findCampaign(db, parsedId.data);
    const result = await reviewCampaign(db, parsedId.data, {
      reviewerId: actor.id,
      approve,
      note,
      seenAt: seen,
    });
    if (!result.ok) return result;

    const reason: AuditDetails = note ? { reason: note } : {};
    if (result.kind === "new") {
      await recordAudit(db, {
        actor,
        action: approve ? "campaign.approved" : "campaign.rejected",
        target: before?.slug ?? String(parsedId.data),
        details: note ? reason : undefined,
      });
    } else {
      await recordAudit(db, {
        actor,
        action: approve ? "campaign.change_approved" : "campaign.change_rejected",
        target: result.before.slug,
        details: { ...campaignChanges(result.before, result.after), ...reason },
      });
    }
    return { ok: true };
  });
};

export const deleteCampaign = async (id: unknown): Promise<CatalogResult> => {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  return catalogChange("campaigns:delete", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
    const before = await findCampaign(db, parsedId.data);
    const result = await removeCampaign(db, parsedId.data);
    if (result.ok && before) {
      await recordAudit(db, { actor, action: "campaign.deleted", target: before.slug });
    }
    return result;
  });
};

export const changeFundAccess = async (id: unknown, isActive: unknown): Promise<CatalogResult> => {
  const parsed = z.tuple([z.enum(FUND_IDS), z.boolean()]).safeParse([id, isActive]);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const [fundId, active] = parsed.data;
  return catalogChange("funds:edit", FUND_SETTINGS_TAG, async (db, actor) => {
    const before = (await listFunds(db)).find((fund) => fund.id === fundId);
    const result = await setFundActive(db, fundId, active);
    if (result.ok && before?.isActive !== active) {
      await recordAudit(db, {
        actor,
        action: active ? "fund.turned_on" : "fund.turned_off",
        target: fundId,
      });
    }
    return result;
  });
};

export const reorderFunds = async (order: unknown): Promise<CatalogResult> => {
  const parsed = fundOrderSchema.safeParse(order);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return catalogChange("funds:edit", FUND_SETTINGS_TAG, async (db, actor) => {
    await saveFundOrder(db, parsed.data);
    await recordAudit(db, {
      actor,
      action: "fund.reordered",
      details: { order: parsed.data.join(", ") },
    });
    return { ok: true };
  });
};
