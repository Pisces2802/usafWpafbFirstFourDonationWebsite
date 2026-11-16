import { expect, type Locator, type Page, test } from "@playwright/test";

import { interceptPost, messages, path, waitForHydration } from "./fixtures";

/**
 * Keyboard-only runs through the donate page and the forms: every control is reached with Tab,
 * shows where focus is, and works with the keys people expect. A screen reader pass is still
 * needed; this catches traps, unreachable controls and missing focus styles.
 */

const MAX_TABS = 80;

/** Whether the focused element, or the label or wrapper drawing its focus ring, shows focus. */
const focusIsVisible = (page: Page) =>
  page.evaluate(() => {
    const shows = (el: Element | null) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      return outline || style.boxShadow !== "none";
    };
    let el: Element | null = document.activeElement;
    for (let depth = 0; el && depth < 3; depth += 1, el = el.parentElement) {
      if (shows(el)) return true;
    }
    return false;
  });

/** What has focus, for failure messages. */
const describeFocus = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "nothing";
    const name = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? "";
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> ${name}`;
  });

/** Presses Tab until `target` has focus, checking every stop on the way shows its focus. */
const tabTo = async (page: Page, target: Locator) => {
  for (let presses = 0; presses < MAX_TABS; presses += 1) {
    await page.keyboard.press("Tab");
    const focused = await describeFocus(page);
    expect(await focusIsVisible(page), `no visible focus on ${focused}`).toBe(true);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Couldn't reach ${target} with Tab in ${MAX_TABS} presses`);
};

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  const { Common } = await messages("en");
  await page.goto(path("/about", "en"));
  await waitForHydration(page);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: Common.skipToContent });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("a monthly gift can be filled in and sent with the keyboard alone", async ({ page }) => {
  const { Donate, QuickGive } = await messages("en");
  const checkout = await interceptPost(page, "/api/checkout", {
    status: 503,
    body: { error: "failed" },
  });
  await page.goto(path("/donate", "en"));
  await waitForHydration(page);
  await page.locator("main").focus();

  // Radio groups take one Tab stop; arrow keys change the choice.
  const oneTime = page.getByRole("radio", { name: QuickGive.oneTime, exact: true }).first();
  await tabTo(page, oneTime);
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: QuickGive.monthly, exact: true }).first(),
  ).toBeChecked();

  const custom = page.getByRole("textbox", { name: QuickGive.customLabel });
  await tabTo(page, custom);
  await page.keyboard.type("40");

  for (const [label, value] of [
    [Donate.firstName, "Ana"],
    [Donate.lastName, "Ruiz"],
    [Donate.email, "ana@example.com"],
  ] as const) {
    await tabTo(page, page.getByRole("textbox", { name: label, exact: true }));
    await page.keyboard.type(value);
  }

  await tabTo(page, page.getByRole("button", { name: Donate.submit }));
  await page.keyboard.press("Enter");

  const status = page.getByText(
    new RegExp(`${Donate.checkoutStatus.unavailable}|${Donate.checkoutStatus.failed}`),
  );
  await expect(status).toBeVisible();
  if (checkout.length > 0) {
    expect(checkout[0]).toMatchObject({
      donation: { frequency: "monthly", amountCents: 4000, donor: { firstName: "Ana" } },
    });
  }
});

test("the error summary can be followed back to a field with the keyboard", async ({ page }) => {
  const { Donate } = await messages("en");
  await page.goto(path("/donate", "en"));
  await waitForHydration(page);

  await page.getByRole("button", { name: Donate.submit }).focus();
  await page.keyboard.press("Enter");
  const summary = page
    .getByRole("region")
    .filter({ has: page.getByRole("heading") })
    .first();
  await expect(summary).toBeFocused();

  await tabTo(page, summary.getByRole("link", { name: Donate.errors.donor.email }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: Donate.email, exact: true })).toBeFocused();
});

test("the volunteer form works with Tab, Space and Enter", async ({ page }) => {
  const { Volunteer, Forms } = await messages("en");
  const sent = await interceptPost(page, "/api/volunteer");
  await page.goto(path("/get-involved", "en"));
  await waitForHydration(page);
  await page.locator("main").focus();

  await tabTo(page, page.getByRole("textbox", { name: Volunteer.name }));
  await page.keyboard.type("Jordan Lee");
  await tabTo(page, page.getByRole("textbox", { name: Volunteer.email, exact: true }));
  await page.keyboard.type("jordan@example.com");

  await tabTo(page, page.getByRole("radio", { name: Forms.affiliations.airman }));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("checkbox", { name: Forms.interests.mentoring }));
  await page.keyboard.press("Space");

  await tabTo(page, page.getByRole("button", { name: Volunteer.submit }));
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: Volunteer.successTitle.replace("{name}", "Jordan Lee") }),
  ).toBeFocused();
  expect(sent[0]).toMatchObject({
    form: { affiliation: "airman", interests: ["mentoring"] },
  });
});

test("the contact form works with the keyboard, including the topic list", async ({ page }) => {
  const { Contact } = await messages("en");
  const sent = await interceptPost(page, "/api/contact");
  await page.goto(path("/contact", "en"));
  await waitForHydration(page);
  await page.locator("main").focus();

  await tabTo(page, page.getByRole("textbox", { name: Contact.name }));
  await page.keyboard.type("Sam");
  await tabTo(page, page.getByRole("textbox", { name: Contact.email, exact: true }));
  await page.keyboard.type("sam@example.com");

  const topic = page.getByLabel(Contact.topic);
  await tabTo(page, topic);
  await page.keyboard.press("ArrowDown");
  const chosen = await topic.inputValue();

  await tabTo(page, page.getByRole("textbox", { name: Contact.message }));
  await page.keyboard.type("Typed without a mouse, start to finish.");
  await tabTo(page, page.getByRole("button", { name: Contact.submit }));
  await page.keyboard.press("Enter");

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ form: { name: "Sam", topic: chosen } });
});

test("the footer newsletter sign-up works with the keyboard", async ({ page }) => {
  const { Newsletter } = await messages("en");
  const sent = await interceptPost(page, "/api/newsletter");
  await page.goto(path("/about", "en"));
  await waitForHydration(page);
  await page.locator("main").focus();

  const email = page.locator("footer").getByRole("textbox", { name: Newsletter.footerEmail });
  await tabTo(page, email);
  await page.keyboard.type("pat@example.com");
  await page.keyboard.press("Enter");

  await expect(page.locator("footer").getByText("pat@example.com", { exact: false })).toBeFocused();
  expect(sent[0]).toMatchObject({ form: { email: "pat@example.com" } });
});
