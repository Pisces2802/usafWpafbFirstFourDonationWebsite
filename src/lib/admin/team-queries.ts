import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { Db, Tx } from "@/db";
import { adminRecoveryCodes, adminRoles, adminSessions, adminUsers } from "@/db/schema";
import type { AdminUserValues, TeamError, TeamResult } from "@/lib/admin/team-schema";

const UNIQUE_VIOLATION = "23505";

export const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === UNIQUE_VIOLATION) return true;
  return "cause" in error && isUniqueViolation(error.cause);
};

const teamColumns = {
  id: adminUsers.id,
  name: adminUsers.name,
  email: adminUsers.email,
  roleId: adminUsers.roleId,
  roleName: adminRoles.name,
  roleIsSuper: adminRoles.isSuper,
  /** The role's stored permissions, so the page can tell whose access someone may change. */
  rolePermissions: adminRoles.permissions,
  isActive: adminUsers.isActive,
  emailVerifiedAt: adminUsers.emailVerifiedAt,
  lastSignInAt: adminUsers.lastSignInAt,
  createdAt: adminUsers.createdAt,
  twoFactorMethod: adminUsers.twoFactorMethod,
  /** Whether they use a second step. Secrets never leave the server. */
  hasTwoFactor: sql<boolean>`${adminUsers.twoFactorMethod} is not null`.mapWith(Boolean),
  isLocked: sql<boolean>`${adminUsers.suspendedAt} is not null`.mapWith(Boolean),
  lockedAt: adminUsers.suspendedAt,
  lockReason: adminUsers.suspendReason,
};

/** Everyone with back-office access, active first, then by name. */
export const listAdminUsers = (db: Db) =>
  db
    .select(teamColumns)
    .from(adminUsers)
    .innerJoin(adminRoles, eq(adminUsers.roleId, adminRoles.id))
    .orderBy(desc(adminUsers.isActive), asc(adminUsers.name));

export type AdminTeamRow = Awaited<ReturnType<typeof listAdminUsers>>[number];

/** One person with their role, or undefined. */
export const findTeamMember = async (db: Db, id: number) => {
  const [row] = await db
    .select(teamColumns)
    .from(adminUsers)
    .innerJoin(adminRoles, eq(adminUsers.roleId, adminRoles.id))
    .where(eq(adminUsers.id, id))
    .limit(1);
  return row;
};

/** The active admin user with this email, or undefined. */
export const findActiveAdminUser = async (db: Db, email: string) => {
  const [user] = await db
    .select(teamColumns)
    .from(adminUsers)
    .innerJoin(adminRoles, eq(adminUsers.roleId, adminRoles.id))
    .where(and(eq(adminUsers.email, email.trim().toLowerCase()), eq(adminUsers.isActive, true)))
    .limit(1);
  return user;
};

/**
 * Whether `roleId` is the SuperAdmin role and someone other than `exceptId` already holds it.
 * Locks the SuperAdmin role first, so two people being made SuperAdmin at once wait for each
 * other and the second is refused. The database refuses a second SuperAdmin too.
 */
const superAdminTaken = async (tx: Tx, roleId: number, exceptId?: number) => {
  const [role] = await tx
    .select({ isSuper: adminRoles.isSuper })
    .from(adminRoles)
    .where(eq(adminRoles.id, roleId))
    .for("update");
  if (!role?.isSuper) return false;
  const [holder] = await tx
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(
      and(
        eq(adminUsers.roleId, roleId),
        exceptId === undefined ? undefined : sql`${adminUsers.id} <> ${exceptId}`,
      ),
    )
    .limit(1);
  return holder !== undefined;
};

export const createAdminUser = async (
  db: Db,
  values: AdminUserValues,
  createdById: number | null,
): Promise<TeamResult<{ id: number }>> => {
  try {
    return await db.transaction(async (tx) => {
      if (await superAdminTaken(tx, values.roleId)) {
        return { ok: false, error: "superAdminTaken" } as const;
      }
      const [created] = await tx
        .insert(adminUsers)
        .values({ ...values, createdById })
        .returning({ id: adminUsers.id });
      return { ok: true, id: created!.id } as const;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "emailTaken" };
    throw error;
  }
};

/** Whether this person can use the back office as a SuperAdmin right now. */
const isWorkingSuperAdmin = (row: { isSuper: boolean; isActive: boolean; isLocked: boolean }) =>
  row.isSuper && row.isActive && !row.isLocked;

/**
 * Runs `change` on one admin user unless it would leave no SuperAdmin who can sign in. The target
 * and every working SuperAdmin are locked in one id-ordered query, so two SuperAdmins demoting or
 * locking each other at once can't both succeed and can't deadlock. `staysSuperAdmin` says
 * whether the target is still a working SuperAdmin after the change.
 */
const changeKeepingASuperAdmin = (
  db: Db,
  id: number,
  staysSuperAdmin: (tx: Tx) => Promise<boolean>,
  change: (tx: Tx) => Promise<TeamResult | unknown>,
): Promise<TeamResult> =>
  db.transaction(async (tx) => {
    const superIds = new Set(
      (
        await tx.select({ id: adminRoles.id }).from(adminRoles).where(eq(adminRoles.isSuper, true))
      ).map((row) => row.id),
    );
    const workingSuper = and(
      inArray(adminUsers.roleId, [...superIds]),
      eq(adminUsers.isActive, true),
      isNull(adminUsers.suspendedAt),
    );
    const locked = await tx
      .select({
        id: adminUsers.id,
        isActive: adminUsers.isActive,
        isLocked: sql<boolean>`${adminUsers.suspendedAt} is not null`.mapWith(Boolean),
        roleId: adminUsers.roleId,
      })
      .from(adminUsers)
      .where(or(eq(adminUsers.id, id), workingSuper))
      .orderBy(asc(adminUsers.id))
      .for("update");

    const user = locked.find((row) => row.id === id);
    if (!user) return { ok: false, error: "notFound" } as const;

    const working = (row: (typeof locked)[number]) =>
      isWorkingSuperAdmin({ ...row, isSuper: superIds.has(row.roleId) });
    const others = locked.filter((row) => row.id !== id && working(row));
    if (working(user) && others.length === 0 && !(await staysSuperAdmin(tx))) {
      return { ok: false, error: "lastSuperAdmin" } as const;
    }

    const changed = await change(tx);
    if (isRefusal(changed)) return changed;
    return { ok: true } as const;
  });

const isRefusal = (value: unknown): value is { ok: false; error: TeamError } =>
  typeof value === "object" && value !== null && "ok" in value && value.ok === false;

const isSuperRole = async (tx: Tx, roleId: number) => {
  const [role] = await tx
    .select({ isSuper: adminRoles.isSuper })
    .from(adminRoles)
    .where(eq(adminRoles.id, roleId));
  return role?.isSuper ?? false;
};

export const updateAdminUserRole = (db: Db, id: number, roleId: number) =>
  changeKeepingASuperAdmin(
    db,
    id,
    (tx) => isSuperRole(tx, roleId),
    async (tx) => {
      // There's one SuperAdmin at a time; it's handed over with transferSuperAdmin instead.
      if (await superAdminTaken(tx, roleId, id)) {
        return { ok: false, error: "superAdminTaken" } as const;
      }
      await tx.update(adminUsers).set({ roleId }).where(eq(adminUsers.id, id));
    },
  );

/**
 * Hands SuperAdmin from `fromId`, who holds it, to `toId`, who must be active and unlocked; the
 * person handing over takes `fromRoleId`, which can't be SuperAdmin. Both rows are locked in id
 * order, and the old SuperAdmin steps down before the new one steps up.
 */
export const transferSuperAdmin = (
  db: Db,
  { fromId, toId, fromRoleId }: { fromId: number; toId: number; fromRoleId: number },
): Promise<TeamResult> =>
  db.transaction(async (tx) => {
    if (fromId === toId) return { ok: false, error: "notFound" } as const;
    const [superRole] = await tx
      .select({ id: adminRoles.id })
      .from(adminRoles)
      .where(eq(adminRoles.isSuper, true))
      .limit(1)
      .for("update");
    const [newRole] = await tx
      .select({ isSuper: adminRoles.isSuper })
      .from(adminRoles)
      .where(eq(adminRoles.id, fromRoleId));
    if (!superRole || !newRole || newRole.isSuper) {
      return { ok: false, error: "invalid" } as const;
    }
    const people = await tx
      .select({
        id: adminUsers.id,
        roleId: adminUsers.roleId,
        isActive: adminUsers.isActive,
        suspendedAt: adminUsers.suspendedAt,
      })
      .from(adminUsers)
      .where(inArray(adminUsers.id, [fromId, toId]))
      .orderBy(asc(adminUsers.id))
      .for("update");
    const from = people.find((row) => row.id === fromId);
    const to = people.find((row) => row.id === toId);
    if (!from || from.roleId !== superRole.id)
      return { ok: false, error: "notSuperAdmin" } as const;
    if (!to || !to.isActive) return { ok: false, error: "notFound" } as const;
    if (to.suspendedAt) return { ok: false, error: "memberLocked" } as const;

    await tx.update(adminUsers).set({ roleId: fromRoleId }).where(eq(adminUsers.id, fromId));
    await tx.update(adminUsers).set({ roleId: superRole.id }).where(eq(adminUsers.id, toId));
    return { ok: true } as const;
  });

export const setAdminUserActive = (db: Db, id: number, isActive: boolean) =>
  changeKeepingASuperAdmin(
    db,
    id,
    async () => isActive,
    (tx) => tx.update(adminUsers).set({ isActive }).where(eq(adminUsers.id, id)),
  );

/**
 * Locks an account, e.g. because its password may be known to someone else: it's signed out
 * everywhere and can't sign in until someone unlocks it. Refused for the last working SuperAdmin.
 */
export const lockAdminUser = (
  db: Db,
  id: number,
  { lockedById, reason, now = new Date() }: { lockedById: number; reason: string; now?: Date },
) =>
  changeKeepingASuperAdmin(
    db,
    id,
    async () => false,
    async (tx) => {
      await tx
        .update(adminUsers)
        .set({ suspendedAt: now, suspendedById: lockedById, suspendReason: reason || null })
        .where(eq(adminUsers.id, id));
      await tx.delete(adminSessions).where(eq(adminSessions.adminUserId, id));
    },
  );

/** Unlocks an account; the automatic wrong-password lock is cleared too. */
export const unlockAdminUser = async (db: Db, id: number): Promise<TeamResult> => {
  const [row] = await db
    .update(adminUsers)
    .set({
      suspendedAt: null,
      suspendedById: null,
      suspendReason: null,
      failedSignInCount: 0,
      lockedUntil: null,
    })
    .where(and(eq(adminUsers.id, id), isNotNull(adminUsers.suspendedAt)))
    .returning({ id: adminUsers.id });
  return row ? { ok: true } : { ok: false, error: "notLocked" };
};

/** Ends every session someone has, on every device. */
export const endAllSessions = (db: Db, id: number) =>
  db.delete(adminSessions).where(eq(adminSessions.adminUserId, id));

/**
 * Turns off someone's second step: their authenticator app, emailed codes and recovery codes stop
 * working and all their sessions end. If their role needs two-step verification, they set it up
 * again at their next sign-in. Only for active people who use one.
 */
export const resetAdminTwoFactor = (db: Db, id: number): Promise<TeamResult> =>
  db.transaction(async (tx) => {
    const [user] = await tx
      .update(adminUsers)
      .set({ twoFactorMethod: null, totpSecret: null, totpLastStep: null })
      .where(
        and(
          eq(adminUsers.id, id),
          eq(adminUsers.isActive, true),
          isNotNull(adminUsers.twoFactorMethod),
        ),
      )
      .returning({ id: adminUsers.id });
    if (!user) {
      const [exists] = await tx
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(and(eq(adminUsers.id, id), eq(adminUsers.isActive, true)));
      return { ok: false, error: exists ? "noTwoFactor" : "notFound" } as const;
    }

    await tx.delete(adminRecoveryCodes).where(eq(adminRecoveryCodes.adminUserId, id));
    await tx.delete(adminSessions).where(eq(adminSessions.adminUserId, id));
    return { ok: true } as const;
  });
