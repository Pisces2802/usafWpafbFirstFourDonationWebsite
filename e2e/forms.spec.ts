import { expect, test } from "@playwright/test";

import { interceptPost, messages, path, waitForHydration } from "./fixtures";

test("volunteer sign-up validates, then sends what was entered @mobile", async ({ page }) => {
  const { Volunteer, Forms } = await messages("en");
  const sent = await interceptPost(page, "/api/volunteer");
  await page.goto(path("/get-involved", "en"));
  await waitForHydration(page);

  const submit = page.getByRole("button", { name: Volunteer.submit });
  await submit.click();
  const summary = page.getByRole("region", { name: /^Fix \d+ things? to send this$/ });
  await expect(summary).toBeFocused();
  expect(sent).toHaveLength(0);

  await page.getByRole("textbox", { name: Volunteer.name }).fill("Jordan Lee");
  await page.getByRole("textbox", { name: Volunteer.email, exact: true }).fill("jordan@example.com");
  await page.getByText(Forms.affiliations.airman, { exact: true }).click();
  await page.getByText(Forms.interests.events, { exact: true }).click();
  await page.getByText(Forms.interests.mentoring, { exact: true }).click();
  await submit.click();

  await expect(
    page.getByRole("heading", { name: Volunteer.successTitle.replace("{name}", "Jordan Lee") }),
  ).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({
    locale: "en",
    form: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      affiliation: "airman",
      interests: ["events", "mentoring"],
    },
  });
});

test("a contact link picks the topic, and a server error keeps what was typed", async ({
  page,
}) => {
  const { Contact, Forms } = await messages("es");
  const sent = await interceptPost(page, "/api/contact", {
    status: 503,
    body: { error: "unavailable" },
  });
  await page.goto(`${path("/contact", "es")}?topic=giving`);
  await waitForHydration(page);

  const topic = page.getByLabel(Contact.topic);
  await expect(topic).toHaveValue("giving");

  await page.getByRole("textbox", { name: Contact.name }).fill("Sam");
  await page.getByRole("textbox", { name: Contact.email, exact: true }).fill("sam@example.com");
  const message = page.getByRole("textbox", { name: Contact.message });
  await message.fill("¿Cómo cambio mi donación mensual?");
  await page.getByRole("button", { name: Contact.submit }).click();

  await expect(page.getByText(Forms.status.unavailable)).toBeVisible();
  await expect(message).toHaveValue("¿Cómo cambio mi donación mensual?");
  expect(sent[0]).toMatchObject({ locale: "es", form: { topic: "giving", name: "Sam" } });
});
