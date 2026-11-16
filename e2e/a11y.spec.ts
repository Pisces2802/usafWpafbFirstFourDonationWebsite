import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { SITEMAP_PATHS } from "../src/lib/seo";
import { LOCALES, path } from "./fixtures";

const PAGES = [...SITEMAP_PATHS, "/manage-giving", "/newsletter"] as const;

/** Automated WCAG 2.2 AA checks. They catch roughly a third of issues; keyboard and screen reader passes are still needed. */
for (const locale of LOCALES) {
  for (const page of PAGES) {
    test(`${path(page, locale)} has no detectable WCAG A/AA violations`, async ({
      page: browserPage,
    }) => {
      // Hold the hero video so the scan doesn't wait on the CDN.
      await browserPage.route(/\.(webm|mp4)(\?|$)/, () => {});
      await browserPage.goto(path(page, locale));
      await browserPage.waitForLoadState("load");
      await expect(browserPage.locator("form[aria-busy='true']")).toHaveCount(0);

      const results = await new AxeBuilder({ page: browserPage })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        // Next's dev-only overlay isn't part of the site.
        .exclude("nextjs-portal")
        .analyze();

      const summary = results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
      }));
      expect(summary).toEqual([]);
    });
  }
}
