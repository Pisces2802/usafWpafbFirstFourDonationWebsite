import { describe, expect, it } from "vitest";

import { buildOrganizationJsonLd, buildSitemap, serializeJsonLd, SITEMAP_PATHS } from "@/lib/seo";

const SITE = "https://example.org/";

describe("buildSitemap", () => {
  it("lists every page in every locale with localised URLs and alternates", () => {
    const sitemap = buildSitemap(SITE, []);

    expect(sitemap).toHaveLength(SITEMAP_PATHS.length * 3);
    const donateEs = sitemap.find((entry) => entry.url === "https://example.org/es/donar");
    expect(donateEs?.alternates?.languages).toEqual({
      en: "https://example.org/en/donate",
      es: "https://example.org/es/donar",
      fr: "https://example.org/fr/faire-un-don",
      "x-default": "https://example.org/en/donate",
    });
  });

  it("leaves out the thank-you and manage-giving pages", () => {
    const urls = buildSitemap(SITE, []).map((entry) => entry.url);

    expect(urls.some((url) => url.includes("thank-you") || url.includes("gracias"))).toBe(false);
    expect(urls.some((url) => url.includes("manage-giving"))).toBe(false);
  });

  it("adds each story in every locale, dated by when it was published", () => {
    const sitemap = buildSitemap(SITE, [{ slug: "field-day", publishedOn: "2026-10-01" }]);

    const story = sitemap.find(
      (entry) => entry.url === "https://example.org/fr/temoignages/field-day",
    );
    expect(story?.lastModified).toBe("2026-10-01");
    expect(story?.alternates?.languages).toMatchObject({
      es: "https://example.org/es/historias/field-day",
    });
  });
});

describe("buildOrganizationJsonLd", () => {
  const base = { siteUrl: SITE, locale: "es" as const, name: "FirstFour", description: "Hola" };

  it("points at the localised home and donate pages", () => {
    const data = buildOrganizationJsonLd(base);

    expect(data).toMatchObject({
      "@type": "NGO",
      url: "https://example.org/es",
      potentialAction: { target: "https://example.org/es/donar" },
    });
    expect(data).not.toHaveProperty("nonprofitStatus");
  });

  it("claims 501(c)(3) status only with an EIN", () => {
    expect(buildOrganizationJsonLd({ ...base, ein: "12-3456789" })).toMatchObject({
      taxID: "12-3456789",
      nonprofitStatus: "Nonprofit501c3",
    });
  });
});

describe("serializeJsonLd", () => {
  it("can't close the script tag early", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});
