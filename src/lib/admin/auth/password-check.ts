import "server-only";

import type { Db } from "@/db";
import { verifyPassword } from "@/lib/admin/auth/crypto";
import { countHits, recordHit } from "@/lib/rate-limit";
import { z } from "@/lib/zod";

/** Wrong passwords allowed per person in 15 minutes before these checks pause. */
const MAX_WRONG_PASSWORDS = 5;
const WRONG_PASSWORD_WINDOW_MS = 15 * 60_000;

const passwordSchema = z.string().min(1).max(128);

/**
 * Asks a signed-in person for their password again before something that matters, like changing
 * how they sign in or handing over SuperAdmin, so a session left open isn't enough. Only wrong
 * passwords count towards the limit.
 */
export const checkCurrentPassword = async (
  db: Db,
  user: { id: number; passwordHash: string | null },
  password: unknown,
): Promise<"ok" | "wrongPassword" | "rateLimited"> => {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success || !user.passwordHash) return "wrongPassword";
  const key = `admin-setup-password-fail:${user.id}`;
  if ((await countHits(db, key, WRONG_PASSWORD_WINDOW_MS)) >= MAX_WRONG_PASSWORDS) {
    return "rateLimited";
  }
  if (!(await verifyPassword(parsed.data, user.passwordHash))) {
    await recordHit(db, key, WRONG_PASSWORD_WINDOW_MS);
    return "wrongPassword";
  }
  return "ok";
};
