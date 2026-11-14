import { expect, test } from "@playwright/test";

import { messages } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // Hold the video files so the test doesn't depend on the CDN; the element still renders.
  await page.route(/\.(webm|mp4)(\?|$)/, () => {});
});

test("reduced motion shows the still poster and no video @mobile", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.route(/\.(webm|mp4)(\?|$)/, () => {});
  const en = await messages("en");

  await page.goto("/en");

  await expect(page.locator("img[fetchpriority='high']").first()).toBeVisible();
  // Give the client a moment to decide; the video must never appear.
  await page.waitForTimeout(1000);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: en.Home.pauseVideo })).toHaveCount(0);
  await context.close();
});

test("the background video can be paused and played again", async ({ page }) => {
  const en = await messages("en");
  await page.goto("/en");

  await expect(page.locator("video")).toHaveCount(1);
  const toggle = page.getByRole("button", { name: /background video/ });
  await expect(toggle).toBeVisible();

  const before = await toggle.getAttribute("aria-label");
  await toggle.click();
  const after = before === en.Home.pauseVideo ? en.Home.playVideo : en.Home.pauseVideo;
  await expect(toggle).toHaveAttribute("aria-label", after);
});
