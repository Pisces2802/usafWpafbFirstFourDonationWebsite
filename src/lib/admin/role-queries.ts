import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";

import type { Db } from "@/db";
import { adminRoles, adminUsers } from "@/db/schema";
import { isUniqueViolation } from "@/lib/admin/team-queries";
import type { RoleValues, TeamResult } from "@/lib/admin/team-schema";

/** Every role with how many people hold it: SuperAdmin first, built-in roles next, then by name. */
export const listRoles = (db: Db) =>
  db
    .select({
      id: adminRoles.id,
      slug: adminRoles.slug,
      name: adminRoles.name,
      description: adminRoles.description,
      permissions: adminRoles.permissions,
      isSuper: adminRoles.isSuper,
      isBuiltIn: adminRoles.isBuiltIn,
      memberCount: count(adminUsers.id),
    })
    .from(adminRoles)
    .leftJoin(adminUsers, eq(adminUsers.roleId, adminRoles.id))
    .groupBy(adminRoles.id)
    .orderBy(desc(adminRoles.isSuper), desc(adminRoles.isBuiltIn), asc(adminRoles.id));

export type AdminRoleRow = Awaited<ReturnType<typeof listRoles>>[number];

export const findRole = async (db: Db, id: number) => {
  const [role] = await db.select().from(adminRoles).where(eq(adminRoles.id, id)).limit(1);
  return role;
};

export const findRoleBySlug = async (db: Db, slug: string) => {
  const [role] = await db.select().from(adminRoles).where(eq(adminRoles.slug, slug)).limit(1);
  return role;
};

export const insertRole = async (
  db: Db,
  values: RoleValues,
  createdById: number,
): Promise<TeamResult<{ id: number }>> => {
  try {
    const [role] = await db
      .insert(adminRoles)
      .values({ ...values, createdById })
      .returning({ id: adminRoles.id });
    return { ok: true, id: role!.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "roleNameTaken" };
    throw error;
  }
};

/** Saves a custom role's name, description and permissions. Built-in roles are never changed. */
export const saveRole = async (db: Db, id: number, values: RoleValues): Promise<TeamResult> => {
  try {
    const [role] = await db
      .update(adminRoles)
      .set(values)
      .where(and(eq(adminRoles.id, id), eq(adminRoles.isBuiltIn, false)))
      .returning({ id: adminRoles.id });
    return role ? { ok: true } : { ok: false, error: "notFound" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "roleNameTaken" };
    throw error;
  }
};

/**
 * Deletes a role the group added. Built-in roles stay, and a role someone still holds can't go
 * (the foreign key refuses it too), so nobody is left without a role.
 */
export const removeRole = (db: Db, id: number): Promise<TeamResult> =>
  db.transaction(async (tx) => {
    const [role] = await tx
      .select({ isBuiltIn: adminRoles.isBuiltIn })
      .from(adminRoles)
      .where(eq(adminRoles.id, id))
      .for("update");
    if (!role) return { ok: false, error: "notFound" } as const;
    if (role.isBuiltIn) return { ok: false, error: "roleBuiltIn" } as const;

    const [held] = await tx
      .select({ total: count() })
      .from(adminUsers)
      .where(eq(adminUsers.roleId, id));
    if ((held?.total ?? 0) > 0) return { ok: false, error: "roleInUse" } as const;

    await tx.delete(adminRoles).where(eq(adminRoles.id, id));
    return { ok: true } as const;
  });
