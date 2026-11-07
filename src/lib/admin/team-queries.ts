import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";

import type { Db, Tx } from "@/db";
import { adminUsers } from "@/db/schema";
import type { AdminRole } from "@/lib/admin/permissions";
import type { AdminUserValues, TeamResult } from "@/lib/admin/team-schema";

const UNIQUE_VIOLATION = "23505";

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === UNIQUE_VIOLATION) return true;
  return "cause" in error && isUniqueViolation(error.cause);
};

const teamColumns = {
  id: adminUsers.id,
  name: adminUsers.name,
  email: adminUsers.email,
  role: adminUsers.role,
  isActive: adminUsers.isActive,
  emailVerifiedAt: adminUsers.emailVerifiedAt,
  lastSignInAt: adminUsers.lastSignInAt,
  createdAt: adminUsers.createdAt,
};

/** Everyone with back-office access, active first, then by name. */
export const listAdminUsers = (db: Db) =>
  db.select(teamColumns).from(adminUsers).orderBy(desc(adminUsers.isActive), asc(adminUsers.name));

export type AdminTeamRow = Awaited<ReturnType<typeof listAdminUsers>>[number];

/** The active admin user with this email, or undefined. */
export const findActiveAdminUser = async (db: Db, email: string) => {
  const [user] = await db
    .select(teamColumns)
    .from(adminUsers)
    .where(and(eq(adminUsers.email, email.trim().toLowerCase()), eq(adminUsers.isActive, true)))
    .limit(1);
  return user;
};

export const createAdminUser = async (
  db: Db,
  values: AdminUserValues,
  createdById: number | null,
): Promise<TeamResult<{ id: number }>> => {
  try {
    const [created] = await db
      .insert(adminUsers)
      .values({ ...values, createdById })
      .returning({ id: adminUsers.id });
    return { ok: true, id: created!.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "emailTaken" };
    throw error;
  }
};

/**
 * Runs `change` on one admin user unless it would leave no active owner. The target and every
 * active owner are locked in one id-ordered query, so two owners demoting each other at once
 * can't both succeed and can't deadlock.
 */
const changeKeepingAnOwner = (
  db: Db,
  id: number,
  staysActiveOwner: boolean,
  change: (tx: Tx) => Promise<unknown>,
): Promise<TeamResult> =>
  db.transaction(async (tx) => {
    const activeOwner = and(eq(adminUsers.role, "owner"), eq(adminUsers.isActive, true));
    const locked = await tx
      .select({ id: adminUsers.id, role: adminUsers.role, isActive: adminUsers.isActive })
      .from(adminUsers)
      .where(or(eq(adminUsers.id, id), activeOwner))
      .orderBy(asc(adminUsers.id))
      .for("update");

    const user = locked.find((row) => row.id === id);
    if (!user) return { ok: false, error: "notFound" } as const;

    const isActiveOwner = user.role === "owner" && user.isActive;
    const otherOwners = locked.filter(
      (row) => row.id !== id && row.role === "owner" && row.isActive,
    );
    if (isActiveOwner && !staysActiveOwner && otherOwners.length === 0) {
      return { ok: false, error: "lastOwner" } as const;
    }

    await change(tx);
    return { ok: true } as const;
  });

export const updateAdminUserRole = (db: Db, id: number, role: AdminRole) =>
  changeKeepingAnOwner(db, id, role === "owner", (tx) =>
    tx.update(adminUsers).set({ role }).where(eq(adminUsers.id, id)),
  );

export const setAdminUserActive = (db: Db, id: number, isActive: boolean) =>
  changeKeepingAnOwner(db, id, isActive, (tx) =>
    tx.update(adminUsers).set({ isActive }).where(eq(adminUsers.id, id)),
  );
