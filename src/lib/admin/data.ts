import "server-only";

import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin/access";
import { listAuditEvents } from "@/lib/admin/audit";
import { listCampaigns, listFunds } from "@/lib/admin/catalog-queries";
import type { AdminPermission } from "@/lib/admin/permissions";
import { can } from "@/lib/admin/permissions";
import {
  getAdminOverview,
  getDashboardInsights,
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

/** Totals and chart data, plus recent gifts only for roles that can see donations. */
export const loadOverview = async () => {
  const { user, db } = await withAdminDb("dashboard:view");
  if (!db) return null;
  const [overview, insights, recent] = await Promise.all([
    getAdminOverview(db),
    getDashboardInsights(db),
    can(user.role, "donations:view") ? listDonations(db, { limit: 6 }) : null,
  ]);
  return { overview, insights, recent, canViewDonors: can(user.role, "donors:view") };
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

/** The audit log, newest first. Owners only. */
export const loadAuditLog = async () => {
  const { db } = await withAdminDb("audit:view");
  return db ? listAuditEvents(db) : null;
};

/** Campaigns with what each has raised, for people who manage them. */
export const loadCampaigns = async () => {
  const { db } = await withAdminDb("campaigns:manage");
  return db ? listCampaigns(db) : null;
};

/** Funds in their saved order, whether each is on, and what each has raised. */
export const loadFunds = async () => {
  const { db } = await withAdminDb("funds:manage");
  return db ? listFunds(db) : null;
};
