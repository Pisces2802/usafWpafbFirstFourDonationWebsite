import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
  BUILT_IN_ROLES,
  can,
  builtInOnlyReason,
  canGrant,
  conflictWith,
  dutyConflicts,
  grantedPermissions,
  requiresTwoFactor,
  withImpliedPermissions,
} from "@/lib/admin/permissions";
import {
  findRoleBySlug,
  insertRole,
  listRoles,
  removeRole,
  saveRole,
} from "@/lib/admin/role-queries";
import {
  createAdminUser,
  findActiveAdminUser,
  listAdminUsers,
  lockAdminUser,
  resetAdminTwoFactor,
  setAdminUserActive,
  transferSuperAdmin,
  unlockAdminUser,
  updateAdminUserRole,
} from "@/lib/admin/team-queries";
import { adminUserSchema, type RoleValues, roleSchema } from "@/lib/admin/team-schema";

type Slug = (typeof BUILT_IN_ROLES)[number]["slug"];

const grant = (permissions: AdminPermission[], isSuper = false) => ({ isSuper, permissions });
const builtIn = (slug: Slug) => BUILT_IN_ROLES.find((role) => role.slug === slug)!;
const holder = (slug: Slug) => ({ permissions: grantedPermissions(builtIn(slug)) });

describe("permissions", () => {
  it("gives SuperAdmin every permission, including ones added later", () => {
    expect([...grantedPermissions(grant([], true))]).toEqual(ADMIN_PERMISSIONS);
  });

  it("ignores stored permissions the code no longer knows", () => {
    const role = { isSuper: false, permissions: ["team:manage", "funds:read"] };
    expect([...grantedPermissions(role)]).toEqual(["funds:read"]);
  });

  it("keeps donor details away from the coordinator and viewer roles", () => {
    for (const slug of ["coordinator", "viewer"] as const) {
      expect(can(holder(slug), "donors:read")).toBe(false);
      expect(can(holder(slug), "donations:read")).toBe(false);
    }
    expect(can(holder("finance"), "volunteers:read")).toBe(false);
  });

  it("only lets a built-in role act on what it can read", () => {
    for (const role of BUILT_IN_ROLES) {
      const held = role.permissions as readonly AdminPermission[];
      expect(withImpliedPermissions(held), role.slug).toEqual(
        ADMIN_PERMISSIONS.filter((permission) => held.includes(permission)),
      );
    }
  });

  it("adds the read permission an action needs, and the Team page for security actions", () => {
    expect(withImpliedPermissions(["donations:export", "auth:lock"])).toEqual([
      "donations:read",
      "donations:export",
      "identity:read",
      "auth:lock",
    ]);
  });

  it("needs two-step verification for any identity or auth permission", () => {
    expect(requiresTwoFactor(["dashboard:read", "stories:publish"])).toBe(false);
    expect(requiresTwoFactor(["identity:read"])).toBe(true);
    expect(requiresTwoFactor(["auth:lock"])).toBe(true);
    expect(requiresTwoFactor(grantedPermissions(grant([], true)))).toBe(true);
  });

  it("only lets people give out roles they fully hold, and never SuperAdmin", () => {
    const manager = {
      isSuper: false,
      permissions: ["identity:edit", "stories:read", "stories:edit"] as AdminPermission[],
    };
    expect(canGrant(manager, grant(["stories:read"]))).toBe(true);
    expect(canGrant(manager, grant(["stories:read", "stories:publish"]))).toBe(false);
    expect(canGrant(manager, grant([], true))).toBe(false);
    expect(canGrant({ isSuper: true, permissions: [] }, grant([], true))).toBe(true);
  });
});

describe("adminUserSchema", () => {
  it("lowercases and trims emails, and reads the role id from a form value", () => {
    const parsed = adminUserSchema.parse({
      name: " Sam ",
      email: " Sam@Example.COM ",
      roleId: "3",
    });
    expect(parsed).toEqual({ name: "Sam", email: "sam@example.com", roleId: 3 });
  });

  it("rejects missing or made-up role ids", () => {
    for (const roleId of ["", "root", "0", "-1", "1.5"]) {
      expect(adminUserSchema.safeParse({ name: "Sam", email: "s@x.co", roleId }).success).toBe(
        false,
      );
    }
  });
});

describe("roleSchema", () => {
  it("accepts known permissions and refuses others", () => {
    const role = (name: string, permissions: string[]) =>
      roleSchema.safeParse({ name, description: "", permissions }).success;
    expect(role("Comms", ["stories:read"])).toBe(true);
    expect(role("Comms", ["team:manage"])).toBe(false);
    expect(role("Comms", ["settings:edit"])).toBe(false);
    expect(role(" ", [])).toBe(false);
  });

  it("keeps exports, site settings, role changes and two-step resets out of custom roles", () => {
    const role = (permissions: string[]) =>
      roleSchema.safeParse({ name: "Comms", description: "", permissions }).success;
    for (const permission of [
      "donors:export",
      "settings:edit",
      "identity:roles",
      "auth:reset-2fa",
    ]) {
      expect(role([permission]), permission).toBe(false);
    }
  });
});

describe("segregation of duties", () => {
  it("says why a permission is kept to built-in roles", () => {
    expect(builtInOnlyReason("settings:edit")).toBe("platform");
    expect(builtInOnlyReason("subscribers:export")).toBe("export");
    expect(builtInOnlyReason("identity:roles")).toBe("roles");
    expect(builtInOnlyReason("auth:reset-2fa")).toBe("takeover");
    expect(builtInOnlyReason("auth:lock")).toBeNull();
    expect(builtInOnlyReason("stories:edit")).toBeNull();
  });

  it("won't mix managing access with people's details or fundraising", () => {
    expect(dutyConflicts(["identity:create", "donors:read"])).toEqual(["accessAndData"]);
    expect(dutyConflicts(["auth:lock", "funds:edit", "messages:read"])).toEqual([
      "accessAndData",
      "accessAndFundraising",
    ]);
    expect(dutyConflicts(["identity:read", "donors:read", "campaigns:edit"])).toEqual([]);
    expect(dutyConflicts(["auth:lock", "auth:sessions", "stories:edit"])).toEqual([]);

    expect(conflictWith(["identity:edit"], "volunteers:read")).toBe("accessAndData");
    expect(conflictWith(["campaigns:create"], "auth:sessions")).toBe("accessAndFundraising");
    expect(conflictWith(["identity:edit"], "stories:publish")).toBeNull();
    expect(conflictWith(["auth:lock"], "campaigns:approve")).toBe("accessAndFundraising");
  });

  it("drops built-in-only permissions from a custom role that somehow has them", () => {
    expect([
      ...grantedPermissions({
        isSuper: false,
        isBuiltIn: false,
        permissions: ["donors:read", "donors:export", "settings:edit"],
      }),
    ]).toEqual(["donors:read"]);
  });

  it("keeps the built-in roles within the duty rules too", () => {
    for (const role of BUILT_IN_ROLES.filter((r) => !r.isSuper)) {
      expect(dutyConflicts(role.permissions), role.slug).toEqual([]);
    }
  });
});

describe("team queries", () => {
  let db: Db;

  const roleId = async (slug: Slug) => (await findRoleBySlug(db, slug))!.id;
  const add = async (email: string, slug: Slug) => {
    const name = email.split("@")[0]!;
    await createAdminUser(db, { name, email, roleId: await roleId(slug) }, null);
    return (await findActiveAdminUser(db, email))!;
  };
  const lastSuperAdmin = { ok: false, error: "lastSuperAdmin" };

  beforeEach(async () => {
    const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(testDb, { migrationsFolder: "drizzle" });
    db = testDb as unknown as Db;
  });

  it("adds people and refuses a second account for the same email", async () => {
    const owner = await add("owner@example.com", "super-admin");
    expect(owner.roleName).toBe("SuperAdmin");

    const again = await createAdminUser(
      db,
      { name: "Dup", email: "owner@example.com", roleId: await roleId("viewer") },
      owner.id,
    );
    expect(again).toEqual({ ok: false, error: "emailTaken" });
  });

  it("refuses mixed-case emails at the database, so uniqueness can't be dodged", async () => {
    const viewer = await roleId("viewer");
    await expect(
      db.insert(schema.adminUsers).values({ name: "X", email: "X@example.com", roleId: viewer }),
    ).rejects.toThrow();
  });

  it("finds active users by email in any case, and not once deactivated", async () => {
    const viewer = await add("viewer@example.com", "viewer");
    await add("owner@example.com", "super-admin");

    expect((await findActiveAdminUser(db, "Viewer@Example.com"))?.id).toBe(viewer.id);
    expect(await setAdminUserActive(db, viewer.id, false)).toEqual({ ok: true });
    expect(await findActiveAdminUser(db, "viewer@example.com")).toBeUndefined();
  });

  it("never leaves the team without a working SuperAdmin", async () => {
    const first = await add("first@example.com", "super-admin");

    expect(await updateAdminUserRole(db, first.id, await roleId("viewer"))).toEqual(lastSuperAdmin);
    expect(await setAdminUserActive(db, first.id, false)).toEqual(lastSuperAdmin);
    expect(await lockAdminUser(db, first.id, { lockedById: first.id, reason: "" })).toEqual(
      lastSuperAdmin,
    );
  });

  it("has one SuperAdmin at a time", async () => {
    const owner = await add("owner@example.com", "super-admin");
    const kim = await add("kim@example.com", "viewer");
    const superAdmin = await roleId("super-admin");
    const taken = { ok: false, error: "superAdminTaken" };

    expect(
      await createAdminUser(
        db,
        { name: "Two", email: "two@example.com", roleId: superAdmin },
        null,
      ),
    ).toEqual(taken);
    expect(await updateAdminUserRole(db, kim.id, superAdmin)).toEqual(taken);
    expect(await updateAdminUserRole(db, owner.id, superAdmin)).toEqual({ ok: true });

    // The database refuses it too, whatever the app does.
    await expect(
      db
        .update(schema.adminUsers)
        .set({ roleId: superAdmin })
        .where(eq(schema.adminUsers.id, kim.id)),
    ).rejects.toThrow();
    const holders = (await listAdminUsers(db)).filter((row) => row.roleIsSuper);
    expect(holders.map((row) => row.id)).toEqual([owner.id]);
  });

  describe("transferSuperAdmin", () => {
    it("hands SuperAdmin over and gives the old one the role they chose", async () => {
      const owner = await add("owner@example.com", "super-admin");
      const kim = await add("kim@example.com", "finance");
      const identity = await roleId("identity-manager");

      expect(
        await transferSuperAdmin(db, { fromId: owner.id, toId: kim.id, fromRoleId: identity }),
      ).toEqual({ ok: true });
      const after = await listAdminUsers(db);
      expect(after.find((row) => row.id === kim.id)?.roleName).toBe("SuperAdmin");
      expect(after.find((row) => row.id === owner.id)?.roleName).toBe("IdentityManager");
    });

    it("refuses anyone but the SuperAdmin, a SuperAdmin role to step down to, and locked or former people", async () => {
      const owner = await add("owner@example.com", "super-admin");
      const kim = await add("kim@example.com", "finance");
      const lee = await add("lee@example.com", "viewer");
      const viewer = await roleId("viewer");

      expect(
        await transferSuperAdmin(db, { fromId: kim.id, toId: lee.id, fromRoleId: viewer }),
      ).toEqual({ ok: false, error: "notSuperAdmin" });
      expect(
        await transferSuperAdmin(db, {
          fromId: owner.id,
          toId: kim.id,
          fromRoleId: await roleId("super-admin"),
        }),
      ).toEqual({ ok: false, error: "invalid" });
      expect(
        await transferSuperAdmin(db, { fromId: owner.id, toId: owner.id, fromRoleId: viewer }),
      ).toEqual({ ok: false, error: "notFound" });

      await lockAdminUser(db, kim.id, { lockedById: owner.id, reason: "" });
      expect(
        await transferSuperAdmin(db, { fromId: owner.id, toId: kim.id, fromRoleId: viewer }),
      ).toEqual({ ok: false, error: "memberLocked" });
      await setAdminUserActive(db, lee.id, false);
      expect(
        await transferSuperAdmin(db, { fromId: owner.id, toId: lee.id, fromRoleId: viewer }),
      ).toEqual({ ok: false, error: "notFound" });
      expect((await findActiveAdminUser(db, "owner@example.com"))?.roleIsSuper).toBe(true);
    });
  });

  it("locks someone out of every session and keeps the reason until unlocked", async () => {
    const admin = await add("admin@example.com", "super-admin");
    const suspect = await add("suspect@example.com", "finance");
    await db.insert(schema.adminSessions).values({
      adminUserId: suspect.id,
      tokenHash: "suspect-session",
      stage: "active",
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    expect(
      await lockAdminUser(db, suspect.id, { lockedById: admin.id, reason: "Phished password" }),
    ).toEqual({ ok: true });
    const locked = (await listAdminUsers(db)).find((row) => row.id === suspect.id);
    expect(locked).toMatchObject({ isLocked: true, lockReason: "Phished password" });
    const sessions = await db
      .select()
      .from(schema.adminSessions)
      .where(eq(schema.adminSessions.adminUserId, suspect.id));
    expect(sessions).toEqual([]);

    expect(await unlockAdminUser(db, suspect.id)).toEqual({ ok: true });
    expect(await unlockAdminUser(db, suspect.id)).toEqual({ ok: false, error: "notLocked" });
    expect((await listAdminUsers(db)).find((row) => row.id === suspect.id)).toMatchObject({
      isLocked: false,
      lockReason: null,
    });
  });

  describe("roles", () => {
    it("starts with the built-in roles from the code, SuperAdmin first", async () => {
      const roles = await listRoles(db);
      expect(roles.map((role) => role.slug)).toEqual(BUILT_IN_ROLES.map((role) => role.slug));
      for (const role of BUILT_IN_ROLES) {
        const stored = roles.find((row) => row.slug === role.slug);
        expect(stored, role.slug).toMatchObject({
          name: role.name,
          isSuper: role.isSuper,
          isBuiltIn: true,
          permissions: role.permissions,
        });
      }
    });

    it("adds, renames and deletes custom roles, but not built-in or held ones", async () => {
      const admin = await add("admin@example.com", "super-admin");
      const values: RoleValues = { name: "Comms", description: "", permissions: ["stories:read"] };
      const created = await insertRole(db, values, admin.id);
      if (!created.ok) throw new Error(created.error);

      expect(await insertRole(db, { ...values, name: "comms" }, admin.id)).toEqual({
        ok: false,
        error: "roleNameTaken",
      });
      expect(await saveRole(db, created.id, { ...values, name: "Viewer" })).toEqual({
        ok: false,
        error: "roleNameTaken",
      });
      const renamed = { ...values, name: "Everything" };
      for (const slug of ["super-admin", "viewer", "identity-manager"] as const) {
        expect(await saveRole(db, await roleId(slug), renamed), slug).toEqual({
          ok: false,
          error: "notFound",
        });
      }

      const kim = { name: "Kim", email: "kim@example.com", roleId: created.id };
      await createAdminUser(db, kim, admin.id);
      expect(await removeRole(db, created.id)).toEqual({ ok: false, error: "roleInUse" });
      expect(await removeRole(db, await roleId("viewer"))).toEqual({
        ok: false,
        error: "roleBuiltIn",
      });

      const member = (await findActiveAdminUser(db, kim.email))!;
      await updateAdminUserRole(db, member.id, await roleId("viewer"));
      expect(await removeRole(db, created.id)).toEqual({ ok: true });
    });
  });

  it("reports unknown ids and lists active people first", async () => {
    expect(await updateAdminUserRole(db, 999, await roleId("viewer"))).toEqual({
      ok: false,
      error: "notFound",
    });

    await add("zed@example.com", "super-admin");
    const amy = await add("amy@example.com", "viewer");
    await setAdminUserActive(db, amy.id, false);
    await add("bea@example.com", "coordinator");

    const names = (await listAdminUsers(db)).map((row) => row.name);
    expect(names).toEqual(["bea", "zed", "amy"]);
  });

  describe("resetAdminTwoFactor", () => {
    const setUpTwoFactor = async (id: number) => {
      await db
        .update(schema.adminUsers)
        .set({ twoFactorMethod: "authenticator", totpSecret: "encrypted", totpLastStep: 42 })
        .where(eq(schema.adminUsers.id, id));
      await db.insert(schema.adminRecoveryCodes).values([
        { adminUserId: id, codeHash: "a" },
        { adminUserId: id, codeHash: "b" },
      ]);
      await db.insert(schema.adminSessions).values({
        adminUserId: id,
        tokenHash: `session-${id}`,
        stage: "active",
        expiresAt: new Date(Date.now() + 3_600_000),
      });
    };

    const countFor = async (
      table: typeof schema.adminRecoveryCodes | typeof schema.adminSessions,
      id: number,
    ) => (await db.select().from(table).where(eq(table.adminUserId, id))).length;

    it("clears the second step, recovery codes and sessions, and shows in the team list", async () => {
      const owner = await add("owner@example.com", "super-admin");
      const lost = await add("lost@example.com", "finance");
      await setUpTwoFactor(owner.id);
      await setUpTwoFactor(lost.id);

      const before = await listAdminUsers(db);
      expect(before.find((row) => row.id === lost.id)?.hasTwoFactor).toBe(true);

      expect(await resetAdminTwoFactor(db, lost.id)).toEqual({ ok: true });

      const [user] = await db
        .select()
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.id, lost.id));
      expect(user).toMatchObject({ twoFactorMethod: null, totpSecret: null, totpLastStep: null });
      expect(await countFor(schema.adminRecoveryCodes, lost.id)).toBe(0);
      expect(await countFor(schema.adminSessions, lost.id)).toBe(0);
      expect((await listAdminUsers(db)).find((row) => row.id === lost.id)?.hasTwoFactor).toBe(
        false,
      );

      // Nobody else is touched.
      expect(await countFor(schema.adminRecoveryCodes, owner.id)).toBe(2);
      expect(await countFor(schema.adminSessions, owner.id)).toBe(1);
    });

    it("refuses people without two-step verification, without access, or unknown", async () => {
      const fresh = await add("fresh@example.com", "viewer");
      expect(await resetAdminTwoFactor(db, fresh.id)).toEqual({ ok: false, error: "noTwoFactor" });

      await add("owner@example.com", "super-admin");
      const gone = await add("gone@example.com", "viewer");
      await setUpTwoFactor(gone.id);
      await setAdminUserActive(db, gone.id, false);
      expect(await resetAdminTwoFactor(db, gone.id)).toEqual({ ok: false, error: "notFound" });
      expect(await countFor(schema.adminRecoveryCodes, gone.id)).toBe(2);

      expect(await resetAdminTwoFactor(db, 999)).toEqual({ ok: false, error: "notFound" });
    });
  });
});
