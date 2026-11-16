"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";

import { getDb } from "@/db";
import { type AdminUser, requireAdmin } from "@/lib/admin/access";
import { recordAudit } from "@/lib/admin/audit";
import {
  dutyConflicts,
  grantedPermissions,
  holdsAll,
  withImpliedPermissions,
} from "@/lib/admin/permissions";
import { findRole, insertRole, removeRole, saveRole } from "@/lib/admin/role-queries";
import {
  type RoleValues,
  roleSchema,
  type TeamError,
  type TeamResult,
} from "@/lib/admin/team-schema";

const idSchema = z.number().int().positive();

/**
 * Validates a role form, adding the `read` permissions the others need to be usable. The schema
 * already refuses permissions kept to built-in roles; this also refuses duties that must be split
 * between people.
 */
const parseRole = (input: unknown): { values: RoleValues } | { error: TeamError } => {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const permissions = withImpliedPermissions(parsed.data.permissions);
  if (dutyConflicts(permissions).length > 0) return { error: "dutyConflict" };
  return { values: { ...parsed.data, permissions } };
};

/** "+donors:read, −donors:export" style summary of what changed, for the audit log. */
const permissionChanges = (before: readonly string[], after: readonly string[]) =>
  [
    ...after.filter((permission) => !before.includes(permission)).map((p) => `+${p}`),
    ...before.filter((permission) => !after.includes(permission)).map((p) => `−${p}`),
  ].join(", ");

/**
 * Runs a role change for someone with `identity:roles`. Nobody can put a permission in a role
 * that they don't hold themselves, so editing roles can't be used to gain access.
 */
const roleChange = async <TData extends object>(
  run: (db: NonNullable<ReturnType<typeof getDb>>, actor: AdminUser) => Promise<TeamResult<TData>>,
): Promise<TeamResult<TData>> => {
  const actor = await requireAdmin("identity:roles");
  const db = getDb();
  if (!db) return { ok: false, error: "noDatabase" };

  const result = await run(db, actor);
  if (result.ok) refresh();
  return result;
};

export const createRole = async (input: unknown): Promise<TeamResult<{ id: number }>> => {
  const parsed = parseRole(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { values } = parsed;
  return roleChange(async (db, actor) => {
    if (!holdsAll(actor.permissions, values.permissions)) {
      return { ok: false, error: "roleNotAllowed" };
    }
    const result = await insertRole(db, values, actor.id);
    if (result.ok) {
      await recordAudit(db, {
        actor,
        action: "role.created",
        target: values.name,
        details: { permissions: values.permissions.join(", ") },
      });
    }
    return result;
  });
};

export const updateRole = async (id: unknown, input: unknown): Promise<TeamResult> => {
  const parsedId = idSchema.safeParse(id);
  const parsed = parseRole(input);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { values } = parsed;
  return roleChange(async (db, actor) => {
    const role = await findRole(db, parsedId.data);
    if (!role) return { ok: false, error: "notFound" };
    if (role.isBuiltIn) return { ok: false, error: "roleBuiltIn" };
    // Changing your own role could only add to, or cut off, your own access.
    if (role.id === actor.role.id) return { ok: false, error: "ownRole" };
    const before = [...grantedPermissions(role)];
    if (!holdsAll(actor.permissions, [...before, ...values.permissions])) {
      return { ok: false, error: "roleNotAllowed" };
    }

    const result = await saveRole(db, role.id, values);
    if (result.ok) {
      const changes: Record<string, string> = {};
      if (role.name !== values.name) changes.name = values.name;
      const permissions = permissionChanges(before, values.permissions);
      if (permissions) changes.permissions = permissions;
      await recordAudit(db, {
        actor,
        action: "role.updated",
        target: role.name,
        details: changes,
      });
    }
    return result;
  });
};

export const deleteRole = async (id: unknown): Promise<TeamResult> => {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "invalid" };
  return roleChange(async (db, actor) => {
    const role = await findRole(db, parsedId.data);
    if (!role) return { ok: false, error: "notFound" };
    if (!holdsAll(actor.permissions, grantedPermissions(role))) {
      return { ok: false, error: "roleNotAllowed" };
    }
    const result = await removeRole(db, role.id);
    if (result.ok) await recordAudit(db, { actor, action: "role.deleted", target: role.name });
    return result;
  });
};
