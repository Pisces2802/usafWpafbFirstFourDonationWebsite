import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import { getDb } from "@/db";
import { isEmailConfigured, sendNewsletterConfirmation } from "@/lib/emails";
import { processNewsletterSignup } from "@/lib/newsletter";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

/** Footer and /newsletter sign-ups. Emails a confirmation link; always answers the same. */
export const POST = async (request: Request) => {
  const ip = getClientIp(request.headers);

  const { status, body } = await processNewsletterSignup(await request.json().catch(() => null), {
    db: getDb(),
    secret: env.AUTH_SECRET,
    canSend: isEmailConfigured(),
    pageUrl: (locale) =>
      `${env.NEXT_PUBLIC_SITE_URL}${getPathname({ locale, href: "/newsletter" })}`,
    isRateLimited: () =>
      isRateLimited(`newsletter:${ip ?? "unknown"}`, { limit: 5, windowMs: 10 * 60_000 }),
    verify: (token) => verifyTurnstile(token, ip),
    sendConfirmation: sendNewsletterConfirmation,
  });

  return Response.json(body, { status });
};
