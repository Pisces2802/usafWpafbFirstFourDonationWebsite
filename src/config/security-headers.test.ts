import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/config/security-headers";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.split(" ")
    .slice(1) ?? [];

describe("buildContentSecurityPolicy", () => {
  const production = buildContentSecurityPolicy({ isDev: false, heroVideoBaseUrl: "/assets" });

  it("allows Stripe checkout and Turnstile, and nothing else, to run scripts and frames", () => {
    expect(directive(production, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://js.stripe.com",
      "https://*.js.stripe.com",
      "https://challenges.cloudflare.com",
    ]);
    expect(directive(production, "frame-src")).toEqual(
      expect.arrayContaining(["https://js.stripe.com", "https://challenges.cloudflare.com"]),
    );
    expect(directive(production, "connect-src")).toContain("https://api.stripe.com");
  });

  it("locks down framing, plugins and form targets", () => {
    expect(directive(production, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(production, "object-src")).toEqual(["'none'"]);
    expect(directive(production, "base-uri")).toEqual(["'self'"]);
    expect(directive(production, "form-action")).toEqual(["'self'"]);
    expect(production.endsWith("; upgrade-insecure-requests")).toBe(true);
  });

  it("only loosens the policy for development tooling in development", () => {
    const dev = buildContentSecurityPolicy({ isDev: true });

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(production).not.toContain("'unsafe-eval'");
    expect(directive(production, "connect-src")).not.toContain("ws:");
  });

  it("allows hero media from another host only when one is configured", () => {
    const remote = buildContentSecurityPolicy({
      isDev: false,
      heroVideoBaseUrl: "https://media.example.org/hero",
    });

    expect(directive(remote, "media-src")).toEqual(["'self'", "https://media.example.org"]);
    expect(directive(remote, "img-src")).toContain("https://media.example.org");
    expect(directive(production, "media-src")).toEqual(["'self'"]);
  });
});

describe("buildSecurityHeaders", () => {
  it("sends the policy with the other hardening headers", () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders({ isDev: false }).map(({ key, value }) => [key, value]),
    );

    expect(headers).toMatchObject({
      "Content-Security-Policy": buildContentSecurityPolicy({ isDev: false }),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d+$/);
  });
});
