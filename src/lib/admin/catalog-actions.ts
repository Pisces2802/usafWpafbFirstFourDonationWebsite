"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { FUND_IDS } from "@/config/donation";
import { type Db, getDb } from "@/db";
import { type AdminUser, requireAdmin } from "@/lib/admin/access";
import { type AuditDetails, recordAudit } from "@/lib/admin/audit";
import {
  createCampaign as insertCampaign,
  deleteCampaign as removeCampaign,
  findCampaign,
  listFunds,
  saveFundOrder,
  setFundActive,
  updateCampaign as saveCampaign,
} from "@/lib/admin/catalog-queries";
import {
  campaignSchema,
  type CatalogResult,
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
const catalogChange = async (
  permission: AdminPermission,
  tag: string,
  run: (db: Db, actor: AdminUser) => Promise<CatalogResult>,
): Promise<CatalogResult> => {
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
  return catalogChange("campaigns:manage", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
    const result = await insertCampaign(db, record);
    if (result.ok) {
      await recordAudit(db, {
        actor,
        action: "campaign.created",
        target: record.slug,
        details: { goal: record.goalCents / 100 },
      });
    }
    return result;
  });
};

export const updateCampaign = async (id: unknown, input: unknown): Promise<CatalogResult> => {
  const parsedId = idSchema.safeParse(id);
  const parsed = campaignSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { ok: false, error: "invalid" };
  const record = toRecord(parsed.data);
  return catalogChange("campaigns:manage", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
    const before = await findCampaign(db, parsedId.data);
    const result = await saveCampaign(db, parsedId.data, record);
    if (result.ok && before) {
      const changes: AuditDetails = {};
      if (before.slug !== record.slug) changes.slug = record.slug;
      if (before.goalCents !== record.goalCents) changes.goal = record.goalCents / 100;
      if (toDateInput(before.startsAt) !== parsed.data.startsOn) {
        changes.startsOn = parsed.data.startsOn || null;
      }
      if (toDateInput(before.endsAt) !== parsed.data.endsOn) {
        changes.endsOn = parsed.data.endsOn || null;
      }
      if (Object.keys(changes).length) {
        await recordAudit(db, {
          actor,
          action: "campaign.updated",
          target: before.slug,
          details: changes,
        });
      }
    }
    return result;
  });
};

export const deleteCampaign = async (id: unknown): Promise<CatalogResult> => {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  return catalogChange("campaigns:manage", CAMPAIGN_PROGRESS_TAG, async (db, actor) => {
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
  return catalogChange("funds:manage", FUND_SETTINGS_TAG, async (db, actor) => {
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
  return catalogChange("funds:manage", FUND_SETTINGS_TAG, async (db, actor) => {
    await saveFundOrder(db, parsed.data);
    await recordAudit(db, {
      actor,
      action: "fund.reordered",
      details: { order: parsed.data.join(", ") },
    });
    return { ok: true };
  });
};
