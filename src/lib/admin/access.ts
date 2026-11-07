import "server-only";

import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { readSession } from "@/lib/admin/auth/session";
import { type AdminPermission, type AdminRole, can } from "@/lib/admin/permissions";

export type AdminUser = { id: number; name: string; email: string; role: AdminRole };

/**
 * The signed-in back-office user, or null: someone with an active (password and two-factor)
 * session whose access hasn't been removed. Memoised per request.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  await connection();
  const current = await readSession();
  if (!current || current.session.stage !== "active") return null;

  const { id, name, email, role } = current.user;
  return { id, name, email, role };
});

/**
 * The current admin user, after checking they may do `permission`. Anyone not signed in goes to
 * the sign-in page; a signed-in user without the permission gets the 403 page. Call it at the top
 * of every admin loader, server action and route handler.
 */
export const requireAdmin = async (permission?: AdminPermission): Promise<AdminUser> => {
  const user = await getAdminUser();
  if (!user) redirect("/admin/sign-in");
  if (permission && !can(user.role, permission)) forbidden();
  return user;
};

/** Whether the current user may do `permission`, for showing or hiding controls. */
export const hasPermission = async (permission: AdminPermission) => {
  const user = await getAdminUser();
  return user !== null && can(user.role, permission);
};
