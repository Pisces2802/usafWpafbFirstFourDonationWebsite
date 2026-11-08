"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/access";
import { type AuditDetails, recordAudit } from "@/lib/admin/audit";
import type { AuthResult } from "@/lib/admin/auth/schema";
import { findAdminById } from "@/lib/admin/auth/queries";
import { getPlatformSettings, savePlatformSettings } from "@/lib/admin/platform-settings";
import {
  notificationsSchema,
  platformSettingsSchema,
  preferencesSchema,
} from "@/lib/admin/settings-schema";

/** The fields whose value changed, as `{ field: newValue }`, for the audit log. */
const changes = <T extends AuditDetails>(before: T, after: T): AuditDetails =>
  Object.fromEntries(Object.entries(after).filter(([key, value]) => before[key] !== value));

/** The signed-in person's full row, for comparing before and after. */
const currentPerson = async (permission?: "settings:manage") => {
  const actor = await requireAdmin(permission);
  const db = getDb();
  const person = db && (await findAdminById(db, actor.id));
  return db && person ? { db, actor, person } : null;
};

export const updateNotifications = async (input: unknown): Promise<AuthResult> => {
  const parsed = notificationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = await currentPerson();
  if (!current) return { ok: false, error: "unavailable" };
  const { db, actor, person } = current;

  await db.update(adminUsers).set(parsed.data).where(eq(adminUsers.id, actor.id));
  const details = changes(
    {
      notifyVolunteers: person.notifyVolunteers,
      notifyMessages: person.notifyMessages,
      notifySecurity: person.notifySecurity,
    },
    parsed.data,
  );
  if (Object.keys(details).length > 0) {
    await recordAudit(db, { actor, action: "account.notifications_changed", details });
  }
  refresh();
  return { ok: true };
};

export const updatePreferences = async (input: unknown): Promise<AuthResult> => {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = await currentPerson();
  if (!current) return { ok: false, error: "unavailable" };
  const { db, actor, person } = current;

  const values = { timeZone: parsed.data.timeZone || null, pageSize: parsed.data.pageSize };
  await db.update(adminUsers).set(values).where(eq(adminUsers.id, actor.id));
  const details = changes({ timeZone: person.timeZone, pageSize: person.pageSize }, values);
  if (Object.keys(details).length > 0) {
    await recordAudit(db, { actor, action: "account.preferences_changed", details });
  }
  refresh();
  return { ok: true };
};

/** Owners only. Every change is written to the audit log with its new value. */
export const updatePlatformSettings = async (input: unknown): Promise<AuthResult> => {
  const parsed = platformSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = await currentPerson("settings:manage");
  if (!current) return { ok: false, error: "unavailable" };
  const { db, actor } = current;

  const before = await getPlatformSettings(db);
  const values = { ...parsed.data, inboxEmail: parsed.data.inboxEmail || null };
  await savePlatformSettings(db, values, actor.id);
  const details = changes(before, values);
  if (Object.keys(details).length > 0) {
    await recordAudit(db, { actor, action: "platform.settings_changed", details });
  }
  refresh();
  return { ok: true };
};
