import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { ADMIN_PERMISSIONS, ADMIN_ROLES, can, ROLE_PERMISSIONS } from "@/lib/admin/permissions";
import {
  createAdminUser,
  findActiveAdminUser,
  listAdminUsers,
  resetAdminTwoFactor,
  setAdminUserActive,
  updateAdminUserRole,
} from "@/lib/admin/team-queries";
import { adminUserSchema } from "@/lib/admin/team-schema";

describe("roles", () => {
  it("gives owners every permission and is the only role that manages the team", () => {
    expect(ROLE_PERMISSIONS.owner).toEqual(ADMIN_PERMISSIONS);
    expect(ADMIN_ROLES.filter((role) => can(role, "team:manage"))).toEqual(["owner"]);
  });

  it("keeps donor details away from coordinators and viewers", () => {
    for (const role of ["coordinator", "viewer"] as const) {
      expect(can(role, "donors:view")).toBe(false);
      expect(can(role, "donations:view")).toBe(false);
    }
    expect(can("treasurer", "volunteers:view")).toBe(false);
  });

  it("only lets a role export what it can see", () => {
    for (const role of ADMIN_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        if (!permission.endsWith(":export")) continue;
        const view = permission.replace(":export", ":view") as (typeof ADMIN_PERMISSIONS)[number];
        expect(can(role, view), `${role} ${permission}`).toBe(true);
      }
    }
  });

  it("matches the roles the admin:create script accepts", () => {
    const script = readFileSync("scripts/create-admin.mjs", "utf8");
    const roles = /const ROLES = (\[[^\]]*\]);/.exec(script)?.[1];
    expect(JSON.parse(roles ?? "null")).toEqual(ADMIN_ROLES);
  });
});

describe("adminUserSchema", () => {
  it("lowercases and trims emails", () => {
    const parsed = adminUserSchema.parse({
      name: " Sam ",
      email: " Sam@Example.COM ",
      role: "owner",
    });
    expect(parsed).toEqual({ name: "Sam", email: "sam@example.com", role: "owner" });
  });

  it("rejects unknown roles", () => {
    expect(adminUserSchema.safeParse({ name: "Sam", email: "s@x.co", role: "root" }).success).toBe(
      false,
    );
  });
});

describe("team queries", () => {
  let db: Db;

  const add = async (email: string, role: (typeof ADMIN_ROLES)[number]) => {
    await createAdminUser(db, { name: email.split("@")[0]!, email, role }, null);
    return (await findActiveAdminUser(db, email))!;
  };

  beforeEach(async () => {
    const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(testDb, { migrationsFolder: "drizzle" });
    db = testDb as unknown as Db;
  });

  it("adds people and refuses a second account for the same email", async () => {
    const owner = await add("owner@example.com", "owner");
    expect(owner.role).toBe("owner");

    const again = await createAdminUser(
      db,
      { name: "Dup", email: "owner@example.com", role: "viewer" },
      owner.id,
    );
    expect(again).toEqual({ ok: false, error: "emailTaken" });
  });

  it("refuses mixed-case emails at the database, so uniqueness can't be dodged", async () => {
    await expect(
      db.insert(schema.adminUsers).values({ name: "X", email: "X@example.com", role: "viewer" }),
    ).rejects.toThrow();
  });

  it("finds active users by email in any case, and not once deactivated", async () => {
    const viewer = await add("viewer@example.com", "viewer");
    await add("owner@example.com", "owner");

    expect((await findActiveAdminUser(db, "Viewer@Example.com"))?.id).toBe(viewer.id);
    expect(await setAdminUserActive(db, viewer.id, false)).toEqual({ ok: true });
    expect(await findActiveAdminUser(db, "viewer@example.com")).toBeUndefined();
  });

  it("never leaves the team without an active owner", async () => {
    const first = await add("first@example.com", "owner");

    expect(await updateAdminUserRole(db, first.id, "viewer")).toEqual({
      ok: false,
      error: "lastOwner",
    });
    expect(await setAdminUserActive(db, first.id, false)).toEqual({
      ok: false,
      error: "lastOwner",
    });

    const second = await add("second@example.com", "owner");
    expect(await updateAdminUserRole(db, first.id, "treasurer")).toEqual({ ok: true });
    expect(await setAdminUserActive(db, second.id, false)).toEqual({
      ok: false,
      error: "lastOwner",
    });
  });

  it("doesn't count a deactivated owner as the remaining owner", async () => {
    const active = await add("active@example.com", "owner");
    const former = await add("former@example.com", "owner");
    await setAdminUserActive(db, former.id, false);

    expect(await updateAdminUserRole(db, active.id, "viewer")).toEqual({
      ok: false,
      error: "lastOwner",
    });
  });

  it("reports unknown ids and lists active people first", async () => {
    expect(await updateAdminUserRole(db, 999, "viewer")).toEqual({
      ok: false,
      error: "notFound",
    });

    await add("zed@example.com", "owner");
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
        .set({ totpSecret: "encrypted", totpLastStep: 42 })
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

    it("clears the app, recovery codes and sessions, and shows in the team list", async () => {
      const owner = await add("owner@example.com", "owner");
      const lost = await add("lost@example.com", "treasurer");
      await setUpTwoFactor(owner.id);
      await setUpTwoFactor(lost.id);

      const before = await listAdminUsers(db);
      expect(before.find((row) => row.id === lost.id)?.hasTwoFactor).toBe(true);

      expect(await resetAdminTwoFactor(db, lost.id)).toEqual({ ok: true });

      const [user] = await db
        .select()
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.id, lost.id));
      expect(user).toMatchObject({ totpSecret: null, totpLastStep: null });
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

      await add("owner@example.com", "owner");
      const gone = await add("gone@example.com", "viewer");
      await setUpTwoFactor(gone.id);
      await setAdminUserActive(db, gone.id, false);
      expect(await resetAdminTwoFactor(db, gone.id)).toEqual({ ok: false, error: "notFound" });
      expect(await countFor(schema.adminRecoveryCodes, gone.id)).toBe(2);

      expect(await resetAdminTwoFactor(db, 999)).toEqual({ ok: false, error: "notFound" });
    });
  });
});
