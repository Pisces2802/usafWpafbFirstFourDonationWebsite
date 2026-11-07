import "server-only";

import type { z } from "zod";

import { getDb } from "@/db";
import { isOrgNoticeConfigured } from "@/lib/emails";
import { type FormSubmissionDeps, processFormSubmission } from "@/lib/form-submissions";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 };

/** Builds a `POST` route handler for a form, wired to the real database, email and Turnstile. */
export const createFormRoute =
  <T>(
    key: string,
    schema: z.ZodType<T>,
    handlers: Pick<FormSubmissionDeps<T>, "save" | "notify">,
  ) =>
  async (request: Request) => {
    const ip = getClientIp(request.headers);
    const payload = await request.json().catch(() => null);

    const { status, body } = await processFormSubmission(payload, schema, {
      ...handlers,
      db: getDb(),
      canNotify: isOrgNoticeConfigured(),
      isRateLimited: () => isRateLimited(`${key}:${ip ?? "unknown"}`, RATE_LIMIT),
      verify: (token) => verifyTurnstile(token, ip),
    });

    return Response.json(body, { status });
  };
