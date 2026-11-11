import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    CLOUDINARY_CLOUD_NAME: "firstfour",
    CLOUDINARY_API_KEY: "123456789",
    CLOUDINARY_API_SECRET: "abcdefghijklmnop",
  },
}));

const { sanitizeStoryHtml } = await import("@/lib/stories/sanitize");
const { signStoryImageUpload } = await import("@/lib/stories/cloudinary");
const { EMPTY_LOCALE_CONTENT, hasBodyContent, slugify, storyFormSchema } =
  await import("@/lib/stories/story-schema");

const IMAGE = "https://res.cloudinary.com/firstfour/image/upload/f_auto,q_auto/v1/stories/a.jpg";

describe("sanitizeStoryHtml", () => {
  it("keeps what the editor makes", () => {
    const html = `<h2 style="text-align: center">Hi</h2><p><strong>a</strong> <mark data-color="#fde68a" style="background-color: #fde68a; color: inherit">b</mark> <span style="color: #1d4ed8">c</span></p><img src="${IMAGE}" alt="Airmen" width="320" height="180">`;
    expect(sanitizeStoryHtml(html)).toBe(
      `<h2 style="text-align:center">Hi</h2><p><strong>a</strong> <mark data-color="#fde68a" style="background-color:#fde68a;color:inherit">b</mark> <span style="color:#1d4ed8">c</span></p><img src="${IMAGE}" alt="Airmen" width="320" height="180" />`,
    );
  });

  it("removes script, event handlers and unsafe links", () => {
    const html =
      '<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><iframe src="https://x.org"></iframe>';
    expect(sanitizeStoryHtml(html)).toBe("<p>Hi</p><span>bad</span>");
  });

  it("forces links to open safely in a new tab", () => {
    expect(sanitizeStoryHtml('<a href="https://example.org" rel="opener">x</a>')).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it("drops images from anywhere but this Cloudinary account", () => {
    for (const src of [
      "https://evil.example/a.png",
      "https://res.cloudinary.com/someone-else/image/upload/a.png",
      "data:image/png;base64,AAAA",
      "/api/a.png",
    ]) {
      expect(sanitizeStoryHtml(`<p>x</p><img src="${src}">`)).toBe("<p>x</p>");
    }
  });

  it("drops styles and sizes it doesn't expect", () => {
    expect(
      sanitizeStoryHtml(
        `<p style="position: fixed; text-align: left">x</p><img src="${IMAGE}" width="100%" height="50">`,
      ),
    ).toBe(`<p style="text-align:left">x</p><img src="${IMAGE}" alt="" height="50" />`);
  });
});

describe("signStoryImageUpload", () => {
  it("signs the folder, formats and timestamp with the secret", async () => {
    const { createHash } = await import("node:crypto");
    const signed = signStoryImageUpload()!;
    const { allowed_formats, folder, timestamp, signature, api_key } = signed.fields;
    const expected = createHash("sha1")
      .update(
        `allowed_formats=${allowed_formats}&folder=${folder}&timestamp=${timestamp}abcdefghijklmnop`,
      )
      .digest("hex");
    expect(signature).toBe(expected);
    expect(api_key).toBe("123456789");
    expect(signed.uploadUrl).toBe("https://api.cloudinary.com/v1_1/firstfour/image/upload");
  });
});

describe("storyFormSchema", () => {
  const english = {
    title: "The cookout",
    name: "Jaylen",
    role: "Airman",
    summary: "A cookout.",
    quote: "I knew my neighbors.",
    body: "<p>It happened.</p>",
  };
  const base = {
    slug: "the-cookout",
    fundId: "morale",
    publishedOn: "2026-09-14",
    status: "published",
    isFeatured: false,
    isSample: false,
    content: { en: english, es: EMPTY_LOCALE_CONTENT, fr: EMPTY_LOCALE_CONTENT },
  };

  it("accepts English alone", () => {
    expect(storyFormSchema.safeParse(base).success).toBe(true);
  });

  it("requires every English field, including a body with something in it", () => {
    const result = storyFormSchema.safeParse({
      ...base,
      content: { ...base.content, en: { ...english, body: "<p></p>" } },
    });
    expect(result.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["content.en.body", "required"],
    ]);
  });

  it("asks for the rest of a translation once one is started", () => {
    const result = storyFormSchema.safeParse({
      ...base,
      content: { ...base.content, es: { ...EMPTY_LOCALE_CONTENT, title: "La parrillada" } },
    });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "content.es.name",
      "content.es.role",
      "content.es.summary",
      "content.es.quote",
      "content.es.body",
    ]);
    expect(result.error?.issues.every((issue) => issue.message === "incomplete")).toBe(true);
  });

  it("rejects link names that aren't lowercase words and dashes", () => {
    for (const slug of ["Has Spaces", "double--dash", "-leading", "ü"]) {
      expect(storyFormSchema.safeParse({ ...base, slug }).success).toBe(false);
    }
  });
});

describe("helpers", () => {
  it("counts an image alone as body content", () => {
    expect(hasBodyContent(`<p></p><img src="${IMAGE}">`)).toBe(true);
    expect(hasBodyContent("<p>&nbsp;</p>")).toBe(false);
  });

  it("makes link names from titles", () => {
    expect(slugify("Rebuilding the dorm day room!")).toBe("rebuilding-the-dorm-day-room");
    expect(slugify("Une salle à nous")).toBe("une-salle-a-nous");
  });
});
