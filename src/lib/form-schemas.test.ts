import { describe, expect, it } from "vitest";

import {
  contactSchema,
  formRequestSchema,
  isContactTopic,
  manageGivingSchema,
  type VolunteerInput,
  volunteerSchema,
} from "@/lib/form-schemas";

describe("volunteerSchema", () => {
  const valid: VolunteerInput = {
    name: "Jordan Lee",
    email: "jordan@example.com",
    affiliation: "airman",
    interests: ["events"],
  };

  it("accepts the required fields alone", () => {
    expect(volunteerSchema.safeParse(valid).success).toBe(true);
  });

  it("trims text and drops blank optional fields", () => {
    const result = volunteerSchema.parse({
      ...valid,
      name: "  Jordan Lee ",
      email: " jordan@example.com ",
      phone: "   ",
      availability: "",
    });

    expect(result.name).toBe("Jordan Lee");
    expect(result.email).toBe("jordan@example.com");
    expect(result.phone).toBeUndefined();
    expect(result.availability).toBeUndefined();
  });

  it("needs at least one known interest", () => {
    expect(volunteerSchema.safeParse({ ...valid, interests: [] }).success).toBe(false);
    expect(volunteerSchema.safeParse({ ...valid, interests: ["golf"] }).success).toBe(false);
  });

  it("rejects a name that is only spaces and an unknown affiliation", () => {
    expect(volunteerSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(volunteerSchema.safeParse({ ...valid, affiliation: "navy" }).success).toBe(false);
  });

  it("caps free text", () => {
    expect(volunteerSchema.safeParse({ ...valid, availability: "x".repeat(1001) }).success).toBe(
      false,
    );
  });
});

describe("contactSchema", () => {
  const valid = {
    name: "Sam",
    email: "sam@example.com",
    topic: "giving",
    message: "How do I change my monthly gift?",
  };

  it("accepts a normal message", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it("counts the message length after trimming", () => {
    expect(contactSchema.safeParse({ ...valid, message: "  short    " }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "x".repeat(4001) }).success).toBe(false);
  });

  it("only accepts known topics", () => {
    expect(contactSchema.safeParse({ ...valid, topic: "press" }).success).toBe(false);
    expect(isContactTopic("airmen")).toBe(true);
    expect(isContactTopic("press")).toBe(false);
    expect(isContactTopic(undefined)).toBe(false);
  });
});

describe("manageGivingSchema", () => {
  it("trims the email and rejects anything that isn't one", () => {
    expect(manageGivingSchema.parse({ email: " a@example.com " }).email).toBe("a@example.com");
    expect(manageGivingSchema.safeParse({ email: "a@" }).success).toBe(false);
    expect(manageGivingSchema.safeParse({ email: `${"a".repeat(250)}@x.co` }).success).toBe(false);
  });
});

describe("formRequestSchema", () => {
  const schema = formRequestSchema(manageGivingSchema);

  it("wraps the form with a locale and an optional Turnstile token", () => {
    expect(schema.safeParse({ form: { email: "a@example.com" }, locale: "es" }).success).toBe(true);
    expect(
      schema.safeParse({ form: { email: "a@example.com" }, locale: "es", turnstileToken: "t" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown locales and oversized tokens", () => {
    const form = { email: "a@example.com" };
    expect(schema.safeParse({ form, locale: "de" }).success).toBe(false);
    expect(schema.safeParse({ form, locale: "en", turnstileToken: "t".repeat(2049) }).success).toBe(
      false,
    );
  });
});
