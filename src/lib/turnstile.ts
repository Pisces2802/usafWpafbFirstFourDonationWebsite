import "server-only";

import { env } from "@/env";

export type TurnstileResult = "ok" | "failed" | "unconfigured";

/**
 * Verifies a Cloudflare Turnstile token. Without keys, verification is skipped in development and
 * reported as "unconfigured" in production so the caller can refuse the request.
 */
export const verifyTurnstile = async (
  token: string | undefined,
  remoteIp: string | null,
): Promise<TurnstileResult> => {
  if (!env.TURNSTILE_SECRET_KEY) {
    return process.env.NODE_ENV === "production" ? "unconfigured" : "ok";
  }
  if (!token) return "failed";

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success ? "ok" : "failed";
  } catch {
    return "failed";
  }
};
