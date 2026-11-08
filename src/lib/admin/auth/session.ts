import "server-only";

import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import { type Db, getDb } from "@/db";
import { SESSION_COOKIE } from "@/lib/admin/auth/cookie";
import { isAuthConfigured, randomToken, sha256 } from "@/lib/admin/auth/crypto";
import {
  deleteSession,
  findSession,
  insertSession,
  promoteSession,
  type SessionStage,
} from "@/lib/admin/auth/queries";
import { readPlatformSettings } from "@/lib/admin/platform-settings";
import { getClientIp } from "@/lib/rate-limit";

/** The step between password and code lasts 10 minutes. */
const TWO_FACTOR_TTL_MS = 10 * 60_000;

/** How long a signed-in session lasts, as an owner set it on the Platform tab (12 hours by default). */
const activeTtlMs = async (db: Db) => (await readPlatformSettings(db)).sessionHours * 60 * 60_000;

/**
 * Starts a session and sets its cookie. Call only from a server action or route handler. The cookie
 * always lasts as long as a signed-in session; the database enforces the shorter two-factor limit,
 * so finishing setup can promote the session without setting the cookie again.
 */
export const startSession = async (db: Db, adminUserId: number, stage: SessionStage) => {
  const token = randomToken();
  const activeTtl = await activeTtlMs(db);
  const expiresAt = new Date(Date.now() + (stage === "active" ? activeTtl : TWO_FACTOR_TTL_MS));
  const requestHeaders = await headers();

  await insertSession(db, {
    adminUserId,
    tokenHash: sha256(token),
    stage,
    expiresAt,
    ip: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 300) ?? null,
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + activeTtl),
  });
};

/**
 * The current session and its person, or null. Memoised per request. Covers both stages, so
 * callers check `session.stage` themselves.
 */
export const readSession = cache(async () => {
  await connection();
  const db = getDb();
  if (!db || !isAuthConfigured()) return null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await findSession(db, sha256(token));
  return row ? { db, ...row } : null;
});

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof readSession>>>;

/** Ends the current session, if any, and clears its cookie. */
export const endSession = async () => {
  const current = await readSession();
  if (current) await deleteSession(current.db, current.session.id);
  (await cookies()).delete(SESSION_COOKIE);
};

/** Swaps the current session for a new one at `stage`, with a new token. */
export const replaceSession = async (current: CurrentSession, stage: SessionStage) => {
  await deleteSession(current.db, current.session.id);
  await startSession(current.db, current.user.id, stage);
};

/**
 * Moves the current session to `active` without a new token. Setting a cookie in a server action
 * re-renders the page, so two-factor setup uses this to keep the recovery codes on screen.
 */
export const promoteCurrentSession = async (current: CurrentSession) =>
  promoteSession(
    current.db,
    current.session.id,
    new Date(Date.now() + (await activeTtlMs(current.db))),
  );
