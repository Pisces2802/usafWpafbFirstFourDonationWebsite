import { expect, type Page, type Route } from "@playwright/test";

import { routing, type Locale } from "../src/i18n/routing";
import { localizedPath } from "../src/lib/seo";

export const LOCALES = routing.locales;

export const path = localizedPath;

/** Messages for a locale, so tests find things by the same text a visitor reads. */
export const messages = async (locale: Locale) =>
  (await import(`../messages/${locale}.json`, { with: { type: "json" } })).default;

/**
 * Answers `POST endpoint` in the browser instead of the server and records what was sent, so form
 * tests never write to the database or send email.
 */
export const interceptPost = async (
  page: Page,
  endpoint: string,
  reply: { status: number; body?: unknown } = { status: 200, body: { ok: true } },
) => {
  const bodies: unknown[] = [];
  await page.route(`**${endpoint}`, async (route: Route) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: reply.status, json: reply.body ?? {} });
  });
  return bodies;
};

/** Waits until client components have hydrated, so clicks reach React handlers. */
export const waitForHydration = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("form[aria-busy='true']")).toHaveCount(0);
};
