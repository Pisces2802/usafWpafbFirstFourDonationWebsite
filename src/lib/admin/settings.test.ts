import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { AUDIT_ACTIONS, auditCategory } from "@/lib/admin/audit-actions";
import { listAuditEvents, personLabel, recordAudit } from "@/lib/admin/audit";
import {
  ADMIN_PERMISSIONS,
  BUILT_IN_ROLES,
  can,
  grantedPermissions,
} from "@/lib/admin/permissions";
import { getPlatformSettings, savePlatformSettings } from "@/lib/admin/platform-settings";
import { platformSettingsSchema, preferencesSchema } from "@/lib/admin/settings-schema";
import admin from "../../../messages/admin/en.json";

describe("settings schemas", () => {
  it("accepts real time zones, or empty for the site default", () => {
    expect(preferencesSchema.parse({ timeZone: "Africa/Lagos", pageSize: "50" })).toEqual({
      timeZone: "Africa/Lagos",
      pageSize: 50,
    });
    expect(preferencesSchema.safeParse({ timeZone: "", pageSize: "10" }).success).toBe(true);
    expect(preferencesSchema.safeParse({ timeZone: "Mars/Olympus", pageSize: "10" }).success).toBe(
      false,
    );
    expect(preferencesSchema.safeParse({ timeZone: "", pageSize: "25" }).success).toBe(false);
  });

  it("normalises the team inbox and allows leaving it empty", () => {
    const base = { donationsPaused: false, sessionHours: "12" };
    expect(platformSettingsSchema.parse({ ...base, inboxEmail: " Team@Example.org " })).toEqual({
      inboxEmail: "team@example.org",
      donationsPaused: false,
      sessionHours: 12,
    });
    expect(platformSettingsSchema.safeParse({ ...base, inboxEmail: "" }).success).toBe(true);
    expect(platformSettingsSchema.safeParse({ ...base, inboxEmail: "nope" }).success).toBe(false);
    expect(
      platformSettingsSchema.safeParse({ ...base, inboxEmail: "", sessionHours: "48" }).success,
    ).toBe(false);
  });
});

describe("audit actions and permissions", () => {
  it("has a label for every action and permission", () => {
    for (const action of AUDIT_ACTIONS) {
      const [group, name] = action.split(".") as [string, string];
      const labels = admin.audit.actions as Record<string, Record<string, string>>;
      expect(labels[group]?.[name], action).toBeTruthy();
      expect(admin.audit.categories, action).toHaveProperty(auditCategory(action));
    }
    for (const permission of ADMIN_PERMISSIONS) {
      expect(admin.permissions, permission).toHaveProperty([permission]);
    }
  });

  it("keeps site settings to SuperAdmin and IdentityManager", () => {
    for (const role of BUILT_IN_ROLES) {
      const holder = { permissions: grantedPermissions(role) };
      expect(can(holder, "settings:edit"), role.slug).toBe(
        role.slug === "super-admin" || role.slug === "identity-manager",
      );
      expect(can(holder, "audit:read"), role.slug).toBe(
        ["super-admin", "auditor", "identity-manager"].includes(role.slug),
      );
    }
  });

  it("never gives site settings to a role the group added", () => {
    const custom = {
      isSuper: false,
      isBuiltIn: false,
      permissions: ["settings:edit", "funds:read"],
    };
    expect([...grantedPermissions(custom)]).toEqual(["funds:read"]);
    expect(grantedPermissions({ ...custom, isBuiltIn: true }).has("settings:edit")).toBe(true);
  });

  it("has a name for every permission group", () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(admin.permissionGroups, permission).toHaveProperty([permission.split(":")[0]!]);
    }
  });
});

const superAdminId = async (db: Db) => {
  const [role] = await db
    .select({ id: schema.adminRoles.id })
    .from(schema.adminRoles)
    .where(eq(schema.adminRoles.slug, "super-admin"));
  return role!.id;
};

describe("audit log and platform settings", () => {
  let db: Db;
  let sam: typeof schema.adminUsers.$inferSelect;

  beforeEach(async () => {
    const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(testDb, { migrationsFolder: "drizzle" });
    db = testDb as unknown as Db;
    [sam] = (await db
      .insert(schema.adminUsers)
      .values({ name: "Sam", email: "sam@example.com", roleId: await superAdminId(db) })
      .returning()) as [typeof schema.adminUsers.$inferSelect];
  });

  it("lists entries newest first and keeps the actor's name after they're removed", async () => {
    await recordAudit(db, {
      actor: sam,
      action: "auth.signed_in",
      details: { method: "authenticator" },
    });
    await recordAudit(db, {
      actor: null,
      action: "auth.sign_in_failed",
      target: "stranger@example.com",
    });
    await recordAudit(db, {
      actor: sam,
      action: "team.role_changed",
      target: personLabel({ name: "Lee", email: "lee@example.com" }),
      details: { from: "viewer", to: "treasurer" },
    });

    let rows = await listAuditEvents(db);
    expect(rows.map((row) => row.action)).toEqual([
      "team.role_changed",
      "auth.sign_in_failed",
      "auth.signed_in",
    ]);
    expect(rows[0]).toMatchObject({
      actorName: "Sam",
      targetLabel: "Lee <lee@example.com>",
      details: { from: "viewer", to: "treasurer" },
    });
    expect(rows[1]).toMatchObject({ actorName: null, targetLabel: "stranger@example.com" });

    await db.delete(schema.adminUsers);
    rows = await listAuditEvents(db);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.actorEmail).toBe("sam@example.com");
  });

  it("starts with defaults and keeps a single settings row", async () => {
    expect(await getPlatformSettings(db)).toEqual({
      inboxEmail: null,
      donationsPaused: false,
      sessionHours: 12,
    });

    await savePlatformSettings(
      db,
      { inboxEmail: "team@example.org", donationsPaused: true, sessionHours: 8 },
      sam.id,
    );
    await savePlatformSettings(
      db,
      { inboxEmail: null, donationsPaused: true, sessionHours: 4 },
      sam.id,
    );

    expect(await getPlatformSettings(db)).toEqual({
      inboxEmail: null,
      donationsPaused: true,
      sessionHours: 4,
    });
    expect(await db.select().from(schema.platformSettings)).toHaveLength(1);
    await expect(
      savePlatformSettings(
        db,
        { inboxEmail: null, donationsPaused: false, sessionHours: 48 },
        sam.id,
      ),
    ).rejects.toThrow();
  });
});
