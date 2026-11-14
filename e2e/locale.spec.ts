import { expect, test } from "@playwright/test";

import { messages, path, waitForHydration } from "./fixtures";

test("the bare domain sends visitors to the English home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("switching language keeps you on the same page, at its localised address @mobile", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The switcher lives in the mobile menu; covered on desktop.");
  const en = await messages("en");

  await page.goto(path("/donate", "en"));
  await waitForHydration(page);

  await page.getByRole("button", { name: /Language: English$/ }).click();
  const menu = page.getByRole("dialog");
  const spanish = menu.getByRole("link", { name: "Español" });
  await expect(menu.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
  await spanish.click();

  await expect(page).toHaveURL(path("/donate", "es"));
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const es = await messages("es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(es.Donate.title);
  expect(es.Donate.title).not.toBe(en.Donate.title);
});

test("switching language on a story keeps the story", async ({ page }) => {
  await page.goto(path("/stories", "en"));
  const firstStory = page.locator(`main a[href^="${path("/stories", "en")}/"]`).first();
  test.skip((await firstStory.count()) === 0, "No published stories in this database.");

  const href = (await firstStory.getAttribute("href"))!;
  const slug = href.split("/").pop()!;
  await page.goto(href);
  await waitForHydration(page);

  await page.getByRole("button", { name: /Language:/ }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Français" }).click();

  await expect(page).toHaveURL(path({ pathname: "/stories/[slug]", params: { slug } }, "fr"));
});
