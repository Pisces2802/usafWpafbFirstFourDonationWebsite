import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { contactSchema, type Volunteer, volunteerSchema } from "@/lib/form-schemas";
import {
  type FormSubmissionDeps,
  processFormSubmission,
  saveContactMessage,
  saveVolunteer,
} from "@/lib/form-submissions";

vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("@/lib/emails", () => ({ sendOrgNotice: vi.fn() }));

const volunteer = {
  name: "  Jaylen Brooks ",
  email: "jaylen@example.com",
  phone: "",
  affiliation: "airman",
  interests: ["events", "mentoring"],
  availability: "Weekends",
};

const request = (form: unknown = volunteer) => ({ form, locale: "es", turnstileToken: "token" });

let db: Db;

beforeEach(async () => {
  const testDb = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(testDb, { migrationsFolder: "drizzle" });
  db = testDb as unknown as Db;
});

const deps = (overrides: Partial<FormSubmissionDeps<Volunteer>> = {}) => ({
  db,
  canNotify: true,
  isRateLimited: () => false,
  verify: async () => "ok" as const,
  save: vi.fn(saveVolunteer),
  notify: vi.fn(async () => {}),
  ...overrides,
});

describe("schemas", () => {
  it("trims text and drops blank optional fields", () => {
    expect(volunteerSchema.parse(volunteer)).toEqual({
      name: "Jaylen Brooks",
      email: "jaylen@example.com",
      phone: undefined,
      affiliation: "airman",
      interests: ["events", "mentoring"],
      availability: "Weekends",
    });
  });

  it("requires at least one interest and a known affiliation", () => {
    const result = volunteerSchema.safeParse({ ...volunteer, interests: [], affiliation: null });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "affiliation",
      "interests",
    ]);
  });

  it("rejects short contact messages and unknown topics", () => {
    const result = contactSchema.safeParse({
      name: "Sam",
      email: "sam@example.com",
      topic: "spam",
      message: "Hi",
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["topic", "message"]);
  });
});

describe("processFormSubmission", () => {
  it("saves, notifies, and accepts a valid submission", async () => {
    const handlers = deps();
    const result = await processFormSubmission(request(), volunteerSchema, handlers);

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(handlers.notify).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jaylen Brooks" }),
      "es",
    );
    const [row] = await db.select().from(schema.volunteers);
    expect(row).toMatchObject({
      name: "Jaylen Brooks",
      phone: null,
      affiliation: "airman",
      interests: ["events", "mentoring"],
      locale: "es",
    });
  });

  it("rejects before doing any work when rate limited", async () => {
    const handlers = deps({ isRateLimited: () => true });
    expect(await processFormSubmission(request(), volunteerSchema, handlers)).toMatchObject({
      status: 429,
      body: { error: "rate_limited" },
    });
    expect(handlers.save).not.toHaveBeenCalled();
  });

  it("rejects invalid fields and unknown locales", async () => {
    const invalid = await processFormSubmission(
      request({ ...volunteer, email: "nope" }),
      volunteerSchema,
      deps(),
    );
    const badLocale = await processFormSubmission(
      { ...request(), locale: "de" },
      volunteerSchema,
      deps(),
    );
    expect([invalid.status, badLocale.status]).toEqual([400, 400]);
  });

  it("reports unavailable when there's nowhere to send it", async () => {
    const result = await processFormSubmission(
      request(),
      volunteerSchema,
      deps({ db: null, canNotify: false }),
    );
    expect(result).toMatchObject({ status: 503, body: { error: "unavailable" } });
  });

  it("refuses a failed Turnstile check", async () => {
    const handlers = deps({ verify: async () => "failed" });
    expect(await processFormSubmission(request(), volunteerSchema, handlers)).toMatchObject({
      status: 403,
      body: { error: "verification_failed" },
    });
    expect(handlers.save).not.toHaveBeenCalled();
  });

  it("still accepts a saved submission when the email fails", async () => {
    const result = await processFormSubmission(
      request(),
      volunteerSchema,
      deps({ notify: vi.fn(async () => Promise.reject(new Error("Resend down"))) }),
    );
    expect(result.status).toBe(200);
  });

  it("fails when the email is the only record and it doesn't send", async () => {
    const result = await processFormSubmission(
      request(),
      volunteerSchema,
      deps({ db: null, notify: vi.fn(async () => Promise.reject(new Error("Resend down"))) }),
    );
    expect(result).toMatchObject({ status: 502, body: { error: "failed" } });
  });

  it("fails without emailing when the database write fails", async () => {
    const handlers = deps({ save: vi.fn(async () => Promise.reject(new Error("db down"))) });
    expect((await processFormSubmission(request(), volunteerSchema, handlers)).status).toBe(502);
    expect(handlers.notify).not.toHaveBeenCalled();
  });
});

describe("saveContactMessage", () => {
  it("stores the message with its locale", async () => {
    await saveContactMessage(
      db,
      contactSchema.parse({
        name: "Ana",
        email: "ana@example.com",
        topic: "partnering",
        message: "We'd like to sponsor the next cookout.",
      }),
      "fr",
    );
    const [row] = await db.select().from(schema.contactMessages);
    expect(row).toMatchObject({ name: "Ana", topic: "partnering", locale: "fr" });
  });
});
