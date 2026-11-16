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
  listSubscribers,
  listVolunteers,
} from "@/lib/admin/queries";
import { listRoles } from "@/lib/admin/role-queries";
import { findStory, listStories } from "@/lib/admin/story-queries";
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
  const { user, db } = await withAdminDb("dashboard:read");
  if (!db) return null;
  const [overview, insights, recent] = await Promise.all([
    getAdminOverview(db),
    getDashboardInsights(db),
    can(user, "donations:read") ? listDonations(db, { limit: 6 }) : null,
  ]);
  return { overview, insights, recent, canViewDonors: can(user, "donors:read") };
};

export const loadDonations = async () => {
  const { db } = await withAdminDb("donations:read");
  return db ? listDonations(db) : null;
};

export const loadDonors = async () => {
  const { db } = await withAdminDb("donors:read");
  return db ? listDonors(db) : null;
};

export const loadVolunteers = async () => {
  const { db } = await withAdminDb("volunteers:read");
  return db ? listVolunteers(db) : null;
};

export const loadMessages = async () => {
  const { db } = await withAdminDb("messages:read");
  return db ? listContactMessages(db) : null;
};

export const loadSubscribers = async () => {
  const { db } = await withAdminDb("subscribers:read");
  return db ? listSubscribers(db) : null;
};

/** Everyone on the team, every role, and what the person looking can do to them. */
export const loadTeam = async () => {
  const { user, db } = await withAdminDb("identity:read");
  if (!db) return null;
  const [members, roles] = await Promise.all([listAdminUsers(db), listRoles(db)]);
  return {
    members,
    roles,
    viewer: {
      id: user.id,
      roleId: user.role.id,
      isSuper: user.role.isSuper,
      permissions: [...user.permissions],
    },
  };
};

export type TeamViewer = NonNullable<Awaited<ReturnType<typeof loadTeam>>>["viewer"];

/** The audit log, newest first. Owners only. */
export const loadAuditLog = async () => {
  const { db } = await withAdminDb("audit:read");
  return db ? listAuditEvents(db) : null;
};

/** Campaigns with what each has raised, for people who manage them. */
export const loadCampaigns = async () => {
  const { db } = await withAdminDb("campaigns:read");
  return db ? listCampaigns(db) : null;
};

/** Funds in their saved order, whether each is on, and what each has raised. */
export const loadFunds = async () => {
  const { db } = await withAdminDb("funds:read");
  return db ? listFunds(db) : null;
};

/** Every story, published or not, for people who write them. */
export const loadStories = async () => {
  const { db } = await withAdminDb("stories:read");
  return db ? listStories(db) : null;
};

/** One story to edit; undefined when it doesn't exist. */
export const loadStory = async (id: number) => {
  const { db } = await withAdminDb("stories:edit");
  return db ? ((await findStory(db, id)) ?? undefined) : null;
};
