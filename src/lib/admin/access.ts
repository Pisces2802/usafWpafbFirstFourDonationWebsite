import "server-only";

import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { readSession } from "@/lib/admin/auth/session";
import {
  type AdminPermission,
  can,
  grantedPermissions,
  requiresTwoFactor,
} from "@/lib/admin/permissions";

export type AdminUserRole = { id: number; name: string; isSuper: boolean };

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: AdminUserRole;
  permissions: ReadonlySet<AdminPermission>;
  /**
   * Their role needs two-step verification (it holds an `identity:` or `auth:` permission) and
   * they haven't set it up, e.g. because their role just changed. They can't use the back office
   * until they do.
   */
  needsTwoFactorSetup: boolean;
};

/**
 * The signed-in back-office user, or null: someone with an active session whose access hasn't
 * been removed and whose account isn't locked. Memoised per request.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  await connection();
  const current = await readSession();
  if (!current || current.session.stage !== "active") return null;

  const { id, name, email, twoFactorMethod } = current.user;
  // The role row carries isBuiltIn, so a custom role never brings platform permissions with it.
  const permissions = grantedPermissions(current.role);
  return {
    id,
    name,
    email,
    role: { id: current.role.id, name: current.role.name, isSuper: current.role.isSuper },
    permissions,
    needsTwoFactorSetup: twoFactorMethod === null && requiresTwoFactor(permissions),
  };
});

/**
 * The current admin user, after checking they may do `permission`. Anyone not signed in goes to
 * the sign-in page, anyone who must set up two-step verification goes to do that, and a signed-in
 * user without the permission gets the 403 page. Call it at the top of every admin loader, server
 * action and route handler.
 */
export const requireAdmin = async (permission?: AdminPermission): Promise<AdminUser> => {
  const user = await getAdminUser();
  if (!user) redirect("/admin/sign-in");
  if (user.needsTwoFactorSetup) redirect("/admin/two-factor");
  if (permission && !can(user, permission)) forbidden();
  return user;
};

/** Whether the current user may do `permission`, for showing or hiding controls. */
export const hasPermission = async (permission: AdminPermission) => {
  const user = await getAdminUser();
  return user !== null && !user.needsTwoFactorSetup && can(user, permission);
};
