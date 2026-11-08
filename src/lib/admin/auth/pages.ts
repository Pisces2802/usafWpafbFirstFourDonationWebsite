import "server-only";

import { connection } from "next/server";

import { getDb } from "@/db";
import { isAuthConfigured, sha256 } from "@/lib/admin/auth/crypto";
import { findTokenOwner, type TokenPurpose } from "@/lib/admin/auth/queries";

/** Reads one string search param, ignoring repeats. */
export const searchParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export const isSignInAvailable = () => isAuthConfigured() && getDb() !== null;

/**
 * Who an emailed link is for, if it's still valid. Only checks the token; it's used up when the
 * form is submitted, so mail scanners that open links don't spend it.
 */
export const lookUpLink = async (purpose: TokenPurpose, token: string | undefined) => {
  await connection();
  const db = getDb();
  if (!db || !token || token.length > 200) return null;
  return (await findTokenOwner(db, purpose, sha256(token))) ?? null;
};
