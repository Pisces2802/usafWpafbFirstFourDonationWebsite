import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashPassword,
  normalizeRecoveryCode,
  sha256,
  verifyPassword,
} from "@/lib/admin/auth/crypto";
import {
  changePassword,
  claimTotpStep,
  consumeRecoveryCode,
  countUnusedRecoveryCodes,
  enableTwoFactor,
  findSession,
  findTokenOwner,
  insertSession,
  MAX_FAILED_SIGN_INS,
  promoteSession,
  recordFailedSignIn,
  saveToken,
  setPasswordWithToken,
} from "@/lib/admin/auth/queries";
import {
  newPasswordSchema,
  signInSchema,
  tokenPasswordSchema,
  totpCodeSchema,
} from "@/lib/admin/auth/schema";
import {
  base32Decode,
  base32Encode,
  currentTotpStep,
  totpCode,
  totpUri,
  verifyTotp,
} from "@/lib/admin/auth/totp";

vi.mock("@/env", () => ({ env: { AUTH_SECRET: "test-secret-that-is-long-enough-1234567890" } }));

/** RFC 6238 appendix B: the SHA-1 seed is the ASCII string "12345678901234567890". */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors (last six digits)", () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 9]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Decode("gezd gnbv-gy3t")).toEqual(base32Decode("GEZDGNBVGY3T"));
  });

  it("accepts a code from one step either side, and refuses replays", () => {
    const now = 1_700_000_000_000;
    const step = currentTotpStep(now);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now, lastStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", { now })).toBeNull();
  });

  it("builds an otpauth link apps can read", () => {
    const uri = totpUri({ secret: "ABC", account: "sam@example.com", issuer: "FirstFour" });
    expect(uri).toBe(
      "otpauth://totp/FirstFour%3Asam%40example.com?secret=ABC&issuer=FirstFour&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("crypto", () => {
  it("hashes passwords with a salt and verifies them", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await hashPassword("correct horse battery staple")).not.toBe(hash);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery stapler", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    // Four full-cost scrypt runs; slow when the whole suite runs in parallel.
  }, 30_000);

  it("encrypts secrets so they can't be read or altered without the key", () => {
    const stored = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(stored).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(stored)).toBe("JBSWY3DPEHPK3PXP");
    const [version, iv, tag, ciphertext] = stored.split(".");
    const tampered = [version, iv, tag, `A${ciphertext!.slice(1)}`].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("makes ten distinct recovery codes that match however they're typed", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(normalizeRecoveryCode(` ${codes[0]!.toUpperCase().replace("-", " ")} `)).toBe(
      codes[0]!.replace("-", ""),
    );
  });
});

describe("safeNextPath", () => {
  it("only allows back-office paths", () => {
    expect(safeNextPath("/admin/donors?page=2")).toBe("/admin/donors?page=2");
    expect(safeNextPath("/admin")).toBe("/admin");
    for (const bad of [
      "https://evil.test",
      "//evil.test",
      "/administrator",
      "/admin\\@evil",
      "/",
    ]) {
      expect(safeNextPath(bad), bad).toBe("/admin");
    }
    expect(safeNextPath("/admin/sign-in")).toBe("/admin");
    expect(safeNextPath(undefined)).toBe("/admin");
  });
});

describe("auth schemas", () => {
  it("normalises emails and requires long, matching new passwords", () => {
    expect(signInSchema.parse({ email: " Sam@Example.com ", password: "x" }).email).toBe(
      "sam@example.com",
    );
    expect(
      newPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success,
    ).toBe(false);
    const mismatch = newPasswordSchema.safeParse({
      password: "long enough password",
      confirmPassword: "different but long",
    });
    expect(mismatch.error?.issues[0]?.message).toBe("passwordMismatch");
    expect(
      tokenPasswordSchema.safeParse({
        password: "long enough password",
        confirmPassword: "long enough password",
        token: "t".repeat(43),
      }).success,
    ).toBe(true);
  });

  it("accepts codes with a space, as apps display them", () => {
    expect(totpCodeSchema.parse({ code: "123 456" }).code).toBe("123456");
    expect(totpCodeSchema.safeParse({ code: "12a456" }).success).toBe(false);
  });
});

describe("auth queries", () => {
  let db: Db;
  let userId: number;

  beforeEach(async () => {
    const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
    await migrate(testDb, { migrationsFolder: "drizzle" });
    db = testDb as unknown as Db;
    const [user] = await db
      .insert(schema.adminUsers)
      .values({ name: "Sam", email: "sam@example.com", role: "owner" })
      .returning();
    userId = user!.id;
  });

  const session = (stage: "two_factor" | "active", tokenHash: string) =>
    insertSession(db, {
      adminUserId: userId,
      tokenHash,
      stage,
      expiresAt: new Date(Date.now() + 60_000),
      ip: null,
      userAgent: null,
    });

  it("uses a link once, verifies the email and ends existing sessions", async () => {
    await session("active", "old-session");
    const tokenHash = sha256("invite-token");
    await saveToken(db, {
      adminUserId: userId,
      purpose: "verify_email",
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await findTokenOwner(db, "verify_email", tokenHash)).toMatchObject({ name: "Sam" });
    expect(await findTokenOwner(db, "reset_password", tokenHash)).toBeUndefined();

    const set = () =>
      setPasswordWithToken(db, { purpose: "verify_email", tokenHash, passwordHash: "hash" });
    expect(await set()).toBe(userId);
    expect(await set()).toBeNull();
    expect(await findTokenOwner(db, "verify_email", tokenHash)).toBeUndefined();
    expect(await findSession(db, "old-session")).toBeUndefined();

    const [user] = await db.select().from(schema.adminUsers);
    expect(user?.passwordHash).toBe("hash");
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("refuses expired links, replaced links and links for people without access", async () => {
    await saveToken(db, {
      adminUserId: userId,
      purpose: "reset_password",
      tokenHash: "expired",
      expiresAt: new Date(Date.now() - 1),
    });
    expect(
      await setPasswordWithToken(db, {
        purpose: "reset_password",
        tokenHash: "expired",
        passwordHash: "x",
      }),
    ).toBeNull();

    const future = new Date(Date.now() + 60_000);
    await saveToken(db, {
      adminUserId: userId,
      purpose: "reset_password",
      tokenHash: "first",
      expiresAt: future,
    });
    await saveToken(db, {
      adminUserId: userId,
      purpose: "reset_password",
      tokenHash: "second",
      expiresAt: future,
    });
    expect(await findTokenOwner(db, "reset_password", "first")).toBeUndefined();

    await db.update(schema.adminUsers).set({ isActive: false });
    expect(await findTokenOwner(db, "reset_password", "second")).toBeUndefined();
    expect(
      await setPasswordWithToken(db, {
        purpose: "reset_password",
        tokenHash: "second",
        passwordHash: "x",
      }),
    ).toBeNull();
  });

  it(`locks the account after ${MAX_FAILED_SIGN_INS} wrong passwords`, async () => {
    const now = new Date();
    for (let attempt = 1; attempt < MAX_FAILED_SIGN_INS; attempt++) {
      await recordFailedSignIn(db, userId, now);
    }
    let [user] = await db.select().from(schema.adminUsers);
    expect(user?.lockedUntil).toBeNull();

    await recordFailedSignIn(db, userId, now);
    [user] = await db.select().from(schema.adminUsers);
    expect(user?.lockedUntil?.getTime()).toBeGreaterThan(now.getTime());
    expect(user?.failedSignInCount).toBe(0);
  });

  it("accepts each recovery code once and each time step once", async () => {
    await enableTwoFactor(db, {
      adminUserId: userId,
      encryptedSecret: "secret",
      step: 100,
      recoveryCodeHashes: ["a", "b"],
    });
    expect(await countUnusedRecoveryCodes(db, userId)).toBe(2);
    expect(await consumeRecoveryCode(db, userId, "a")).toBe(true);
    expect(await consumeRecoveryCode(db, userId, "a")).toBe(false);
    expect(await consumeRecoveryCode(db, userId, "nope")).toBe(false);
    expect(await countUnusedRecoveryCodes(db, userId)).toBe(1);

    expect(await claimTotpStep(db, userId, 100)).toBe(false);
    expect(await claimTotpStep(db, userId, 101)).toBe(true);
    expect(await claimTotpStep(db, userId, 101)).toBe(false);
  });

  it("finds live sessions only, and keeps the current one on a password change", async () => {
    const current = await session("active", "current");
    await session("active", "other");
    await insertSession(db, {
      adminUserId: userId,
      tokenHash: "stale",
      stage: "active",
      expiresAt: new Date(Date.now() - 1),
      ip: null,
      userAgent: null,
    });
    expect(await findSession(db, "stale")).toBeUndefined();

    await changePassword(db, {
      adminUserId: userId,
      passwordHash: "new",
      keepSessionId: current.id,
    });
    expect(await findSession(db, "current")).toBeDefined();
    expect(await findSession(db, "other")).toBeUndefined();

    await db.update(schema.adminUsers).set({ isActive: false });
    expect(await findSession(db, "current")).toBeUndefined();
  });

  it("promotes a two-factor session in place when setup finishes", async () => {
    const pending = await session("two_factor", "pending");
    const expiresAt = new Date(Date.now() + 3_600_000);
    await promoteSession(db, pending.id, expiresAt);
    const found = await findSession(db, "pending");
    expect(found?.session).toMatchObject({ stage: "active", pendingTotpSecret: null, expiresAt });
  });
});
