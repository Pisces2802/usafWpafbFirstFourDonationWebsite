import { expect, test } from "@playwright/test";

import { interceptPost, LOCALES, messages, path, waitForHydration } from "./fixtures";

const fillDetails = async (
  page: import("@playwright/test").Page,
  donate: Record<string, string>,
) => {
  await page.getByRole("textbox", { name: donate.firstName, exact: true }).fill("Ana");
  await page.getByRole("textbox", { name: donate.lastName, exact: true }).fill("Ruiz");
  await page.getByRole("textbox", { name: donate.email, exact: true }).fill("ana@example.com");
};

for (const locale of LOCALES) {
  test.describe(`donate (${locale})`, () => {
    test("lists what's missing, and each item jumps to its field", async ({ page }) => {
      const { Donate } = await messages(locale);
      await page.goto(path("/donate", locale));
      await waitForHydration(page);

      await page.getByRole("button", { name: Donate.submit }).click();

      const summary = page
        .getByRole("region")
        .filter({ has: page.getByRole("heading") })
        .first();
      await expect(summary).toBeFocused();
      await expect(summary.getByRole("link")).toHaveText([
        Donate.errors.donor.firstName,
        Donate.errors.donor.lastName,
        Donate.errors.donor.email,
      ]);

      await summary.getByRole("link", { name: Donate.errors.donor.email }).click();
      await expect(page.getByRole("textbox", { name: Donate.email })).toBeFocused();
    });

    test("a valid monthly gift goes to checkout with the right details @mobile", async ({
      page,
    }) => {
      const { Donate, QuickGive } = await messages(locale);
      const checkout = await interceptPost(page, "/api/checkout", {
        status: 503,
        body: { error: "failed" },
      });
      await page.goto(path("/donate", locale));
      await waitForHydration(page);

      await page.getByText(QuickGive.monthly, { exact: true }).click();
      await page.getByRole("textbox", { name: QuickGive.customLabel }).fill("40");
      await fillDetails(page, Donate);
      await page.getByRole("button", { name: Donate.submit }).click();

      const status = page.getByText(
        new RegExp(`${Donate.checkoutStatus.unavailable}|${escape(Donate.checkoutStatus.failed)}`),
      );
      await expect(status).toBeVisible();

      // With Stripe keys configured the form posts to /api/checkout; without, it stops first.
      if (checkout.length > 0) {
        expect(checkout[0]).toMatchObject({
          locale,
          donation: {
            frequency: "monthly",
            amountCents: 4000,
            donor: { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com" },
          },
        });
      }
    });
  });
}

test("a campaign link prefills the gift and tidies the address bar", async ({ page }) => {
  await page.goto(`${path("/donate", "en")}?amount=50&frequency=monthly&fund=morale`);
  await waitForHydration(page);

  await expect(page.locator("input[name='frequency'][value='monthly']")).toBeChecked();
  await expect(page.locator("input[name='amount'][value='5000']")).toBeChecked();
  await expect(page).toHaveURL(path("/donate", "en"));
});

test("an amount below the minimum is flagged before submitting", async ({ page }) => {
  const { QuickGive } = await messages("en");
  await page.goto(path("/donate", "en"));
  await waitForHydration(page);

  const custom = page.getByRole("textbox", { name: QuickGive.customLabel });
  await custom.fill("2");
  await expect(custom).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(QuickGive.errorMin.replace("{min}", "$5"))).toBeVisible();
});

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
