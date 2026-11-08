import "server-only";

import { and, count, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { adminRecoveryCodes, adminSessions, adminTokens, adminUsers } from "@/db/schema";

export const MAX_FAILED_SIGN_INS = 5;
export const LOCKOUT_MS = 15 * 60_000;
export const MAX_TWO_FACTOR_ATTEMPTS = 5;

export type TokenPurpose = (typeof adminTokens.$inferSelect)["purpose"];
export type SessionStage = (typeof adminSessions.$inferSelect)["stage"];

export const findAdminByEmail = async (db: Db, email: string) => {
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.trim().toLowerCase()))
    .limit(1);
  return user;
};

export const findAdminById = async (db: Db, id: number) => {
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return user;
};

/** Counts a wrong password; the fifth in a row locks the account for 15 minutes. */
export const recordFailedSignIn = (db: Db, id: number, now = new Date()) =>
  db
    .update(adminUsers)
    .set({
      failedSignInCount: sql`case when ${adminUsers.failedSignInCount} + 1 >= ${MAX_FAILED_SIGN_INS} then 0 else ${adminUsers.failedSignInCount} + 1 end`,
      lockedUntil: sql`case when ${adminUsers.failedSignInCount} + 1 >= ${MAX_FAILED_SIGN_INS} then ${new Date(now.getTime() + LOCKOUT_MS).toISOString()}::timestamptz else ${adminUsers.lockedUntil} end`,
    })
    .where(eq(adminUsers.id, id));

export const clearFailedSignIns = (db: Db, id: number) =>
  db
    .update(adminUsers)
    .set({ failedSignInCount: 0, lockedUntil: null })
    .where(eq(adminUsers.id, id));

/** Stores a hashed single-use token, replacing any unused one with the same purpose. */
export const saveToken = async (
  db: Db,
  {
    adminUserId,
    purpose,
    tokenHash,
    expiresAt,
  }: { adminUserId: number; purpose: TokenPurpose; tokenHash: string; expiresAt: Date },
) => {
  await db.transaction(async (tx) => {
    await tx
      .delete(adminTokens)
      .where(
        and(
          eq(adminTokens.adminUserId, adminUserId),
          eq(adminTokens.purpose, purpose),
          isNull(adminTokens.usedAt),
        ),
      );
    await tx.insert(adminTokens).values({ adminUserId, purpose, tokenHash, expiresAt });
  });
};

/** The active person a valid, unused token belongs to, without using it up. */
export const findTokenOwner = async (
  db: Db,
  purpose: TokenPurpose,
  tokenHash: string,
  now = new Date(),
) => {
  const [row] = await db
    .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email })
    .from(adminTokens)
    .innerJoin(adminUsers, eq(adminTokens.adminUserId, adminUsers.id))
    .where(
      and(
        eq(adminTokens.tokenHash, tokenHash),
        eq(adminTokens.purpose, purpose),
        isNull(adminTokens.usedAt),
        gt(adminTokens.expiresAt, now),
        eq(adminUsers.isActive, true),
      ),
    )
    .limit(1);
  return row;
};

/**
 * Uses up a token and sets the password in one transaction. Only one request can claim the token,
 * so a link works once even if it's opened twice at the same moment. Every existing session for
 * the person is ended, since whoever had the old password may have been signed in.
 */
export const setPasswordWithToken = (
  db: Db,
  {
    purpose,
    tokenHash,
    passwordHash,
    now = new Date(),
  }: { purpose: TokenPurpose; tokenHash: string; passwordHash: string; now?: Date },
) =>
  db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(adminTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(adminTokens.tokenHash, tokenHash),
          eq(adminTokens.purpose, purpose),
          isNull(adminTokens.usedAt),
          gt(adminTokens.expiresAt, now),
        ),
      )
      .returning({ adminUserId: adminTokens.adminUserId });
    if (!claimed) return null;

    const [user] = await tx
      .update(adminUsers)
      .set({
        passwordHash,
        emailVerifiedAt: sql`coalesce(${adminUsers.emailVerifiedAt}, ${now.toISOString()}::timestamptz)`,
        failedSignInCount: 0,
        lockedUntil: null,
      })
      .where(and(eq(adminUsers.id, claimed.adminUserId), eq(adminUsers.isActive, true)))
      .returning({ id: adminUsers.id });
    if (!user) return null;

    await tx.delete(adminSessions).where(eq(adminSessions.adminUserId, user.id));
    return user.id;
  });

/** Changes a signed-in person's password and ends their other sessions. */
export const changePassword = (
  db: Db,
  {
    adminUserId,
    passwordHash,
    keepSessionId,
  }: {
    adminUserId: number;
    passwordHash: string;
    keepSessionId: number;
  },
) =>
  db.transaction(async (tx) => {
    await tx.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, adminUserId));
    await tx
      .delete(adminSessions)
      .where(and(eq(adminSessions.adminUserId, adminUserId), ne(adminSessions.id, keepSessionId)));
  });

export const insertSession = async (
  db: Db,
  values: {
    adminUserId: number;
    tokenHash: string;
    stage: SessionStage;
    expiresAt: Date;
    ip: string | null;
    userAgent: string | null;
  },
) => {
  const [session] = await db.insert(adminSessions).values(values).returning();
  return session!;
};

/** A live session and its person. Expired sessions, and people who've lost access, return nothing. */
export const findSession = async (db: Db, tokenHash: string, now = new Date()) => {
  const [row] = await db
    .select({ session: adminSessions, user: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        gt(adminSessions.expiresAt, now),
        eq(adminUsers.isActive, true),
      ),
    )
    .limit(1);
  return row;
};

/** Finishes the two-factor step: the session becomes signed in, with a new expiry. */
export const promoteSession = (db: Db, id: number, expiresAt: Date) =>
  db
    .update(adminSessions)
    .set({ stage: "active", expiresAt, pendingTotpSecret: null, failedAttempts: 0 })
    .where(eq(adminSessions.id, id));

export const deleteSession = (db: Db, id: number) =>
  db.delete(adminSessions).where(eq(adminSessions.id, id));

export const deleteOtherSessions = (db: Db, adminUserId: number, keepSessionId: number) =>
  db
    .delete(adminSessions)
    .where(and(eq(adminSessions.adminUserId, adminUserId), ne(adminSessions.id, keepSessionId)));

export const countOtherSessions = async (
  db: Db,
  adminUserId: number,
  sessionId: number,
  now = new Date(),
) => {
  const [row] = await db
    .select({ total: count() })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.adminUserId, adminUserId),
        ne(adminSessions.id, sessionId),
        eq(adminSessions.stage, "active"),
        gt(adminSessions.expiresAt, now),
      ),
    );
  return row?.total ?? 0;
};

/** Counts a wrong two-factor code; returns the new total. */
export const recordTwoFactorFailure = async (db: Db, sessionId: number) => {
  const [row] = await db
    .update(adminSessions)
    .set({ failedAttempts: sql`${adminSessions.failedAttempts} + 1` })
    .where(eq(adminSessions.id, sessionId))
    .returning({ failedAttempts: adminSessions.failedAttempts });
  return row?.failedAttempts ?? MAX_TWO_FACTOR_ATTEMPTS;
};

export const setPendingTotpSecret = (db: Db, sessionId: number, encrypted: string) =>
  db
    .update(adminSessions)
    .set({ pendingTotpSecret: encrypted })
    .where(eq(adminSessions.id, sessionId));

/**
 * Records the accepted time step, unless a code at that step or later was already used. Returns
 * false if another request got there first.
 */
export const claimTotpStep = async (db: Db, adminUserId: number, step: number) => {
  const updated = await db
    .update(adminUsers)
    .set({ totpLastStep: step })
    .where(
      and(
        eq(adminUsers.id, adminUserId),
        or(isNull(adminUsers.totpLastStep), lt(adminUsers.totpLastStep, step)),
      ),
    )
    .returning({ id: adminUsers.id });
  return updated.length > 0;
};

/** Saves a confirmed two-factor secret and a fresh set of recovery codes. */
export const enableTwoFactor = (
  db: Db,
  {
    adminUserId,
    encryptedSecret,
    step,
    recoveryCodeHashes,
  }: { adminUserId: number; encryptedSecret: string; step: number; recoveryCodeHashes: string[] },
) =>
  db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ totpSecret: encryptedSecret, totpLastStep: step })
      .where(eq(adminUsers.id, adminUserId));
    await tx.delete(adminRecoveryCodes).where(eq(adminRecoveryCodes.adminUserId, adminUserId));
    await tx
      .insert(adminRecoveryCodes)
      .values(recoveryCodeHashes.map((codeHash) => ({ adminUserId, codeHash })));
  });

export const replaceRecoveryCodes = (db: Db, adminUserId: number, hashes: string[]) =>
  db.transaction(async (tx) => {
    await tx.delete(adminRecoveryCodes).where(eq(adminRecoveryCodes.adminUserId, adminUserId));
    await tx
      .insert(adminRecoveryCodes)
      .values(hashes.map((codeHash) => ({ adminUserId, codeHash })));
  });

/** Uses up one recovery code. False if it doesn't match an unused code. */
export const consumeRecoveryCode = async (
  db: Db,
  adminUserId: number,
  codeHash: string,
  now = new Date(),
) => {
  const used = await db
    .update(adminRecoveryCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(adminRecoveryCodes.adminUserId, adminUserId),
        eq(adminRecoveryCodes.codeHash, codeHash),
        isNull(adminRecoveryCodes.usedAt),
      ),
    )
    .returning({ id: adminRecoveryCodes.id });
  return used.length > 0;
};

export const countUnusedRecoveryCodes = async (db: Db, adminUserId: number) => {
  const [row] = await db
    .select({ total: count() })
    .from(adminRecoveryCodes)
    .where(and(eq(adminRecoveryCodes.adminUserId, adminUserId), isNull(adminRecoveryCodes.usedAt)));
  return row?.total ?? 0;
};

export const recordSignIn = (db: Db, adminUserId: number, now = new Date()) =>
  db.update(adminUsers).set({ lastSignInAt: now }).where(eq(adminUsers.id, adminUserId));

export const updateAdminName = (db: Db, adminUserId: number, name: string) =>
  db.update(adminUsers).set({ name }).where(eq(adminUsers.id, adminUserId));
