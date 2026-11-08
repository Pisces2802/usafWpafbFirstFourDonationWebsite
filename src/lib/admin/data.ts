import "server-only";

import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin/access";
import type { AdminPermission } from "@/lib/admin/permissions";
import { can } from "@/lib/admin/permissions";
import {
  getAdminOverview,
  listContactMessages,
  listDonations,
  listDonors,
  listVolunteers,
} from "@/lib/admin/queries";
import { listAdminUsers } from "@/lib/admin/team-queries";

/**
 * Back-office data access. Every loader checks the current admin's permission before it touches
 * the database, so pages, route handlers and server actions can't skip the check. Loaders return
 * null when no database is configured, so pages can say so instead of failing.
 */
const withAdminDb = async (permission: AdminPermission) => {
  const user = await requireAdmin(permission);
  return { user, db: getDb() };
};

/** Totals, plus recent gifts only for roles that can see donations. */
export const loadOverview = async () => {
  const { user, db } = await withAdminDb("dashboard:view");
  if (!db) return null;
  const [overview, recent] = await Promise.all([
    getAdminOverview(db),
    can(user.role, "donations:view") ? listDonations(db, { limit: 8 }) : null,
  ]);
  return { overview, recent };
};

export const loadDonations = async () => {
  const { db } = await withAdminDb("donations:view");
  return db ? listDonations(db) : null;
};

export const loadDonors = async () => {
  const { db } = await withAdminDb("donors:view");
  return db ? listDonors(db) : null;
};

export const loadVolunteers = async () => {
  const { db } = await withAdminDb("volunteers:view");
  return db ? listVolunteers(db) : null;
};

export const loadMessages = async () => {
  const { db } = await withAdminDb("messages:view");
  return db ? listContactMessages(db) : null;
};

export const loadTeam = async () => {
  const { user, db } = await withAdminDb("team:manage");
  return db ? { currentUserId: user.id, members: await listAdminUsers(db) } : null;
};
