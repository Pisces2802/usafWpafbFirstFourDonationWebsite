import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";

import { env } from "@/env";

/** OWASP's recommended scrypt cost (2^17, r 8, p 1), about 128 MB per hash. */
const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;

const derive = (password: string, salt: Buffer, params: { N: number; r: number; p: number }) =>
  new Promise<Buffer>((resolve, reject) => {
    const options: ScryptOptions = { ...params, maxmem: 256 * params.N * params.r };
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

/** Hashes a password as `scrypt$N$r$p$salt$hash`, so the cost can be raised later. */
export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
};

export const verifyPassword = async (password: string, stored: string) => {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
};

let dummyHash: Promise<string> | null = null;

/**
 * A real hash to check against when there's no account, so a wrong email takes as long as a
 * wrong password and response times don't reveal who's on the team.
 */
export const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));

/** A URL-safe random token for cookies and email links. */
export const randomToken = () => randomBytes(32).toString("base64url");

/** Tokens and recovery codes are stored as SHA-256; they're random, so no salt is needed. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const isAuthConfigured = () => Boolean(env.AUTH_SECRET);

const encryptionKey = () => {
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET isn't set");
  return createHash("sha256").update(`admin-totp:${env.AUTH_SECRET}`).digest();
};

/** AES-256-GCM, stored as `v1.iv.tag.ciphertext`. */
export const encryptSecret = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
};

export const decryptSecret = (stored: string) => {
  const [version, iv, tag, ciphertext] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Ten codes like `k7m2p-x9q4t`, about 50 bits each. */
export const generateRecoveryCodes = (count = 10) =>
  Array.from({ length: count }, () => {
    const chars = Array.from(
      { length: 10 },
      () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
    );
    return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
  });

/** Lowercase without spaces or dashes, so codes match however they're typed. */
export const normalizeRecoveryCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
