import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;
const DIGITS = 6;
/** Accept the previous and next code too, for clock drift between phone and server. */
const DRIFT_STEPS = 1;

export const base32Encode = (bytes: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input: string) => {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

/** A new 160-bit secret in base32, the format authenticator apps expect. */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export const currentTotpStep = (now = Date.now()) => Math.floor(now / 1000 / PERIOD_SECONDS);

/** The RFC 6238 code (HMAC-SHA1, 6 digits) for a base32 secret at a time step. */
export const totpCode = (secret: string, step: number) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
};

/**
 * Checks a 6-digit code against the secret. Returns the matching time step, or null. Steps at or
 * before `lastStep` are refused, so a code that's already been used can't be replayed.
 */
export const verifyTotp = (
  secret: string,
  code: string,
  { lastStep = null, now = Date.now() }: { lastStep?: number | null; now?: number } = {},
) => {
  if (!/^\d{6}$/.test(code)) return null;
  const current = currentTotpStep(now);

  for (let offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset++) {
    const step = current + offset;
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(code))) return step;
  }
  return null;
};

/** The `otpauth://` link encoded in the setup QR code. */
export const totpUri = ({
  secret,
  account,
  issuer,
}: {
  secret: string;
  account: string;
  issuer: string;
}) => {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?${params}`;
};
