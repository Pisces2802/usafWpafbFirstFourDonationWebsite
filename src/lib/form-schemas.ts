import { z } from "zod";

import { routing } from "@/i18n/routing";

export const VOLUNTEER_AFFILIATIONS = ["airman", "military", "family", "community"] as const;
export type VolunteerAffiliation = (typeof VOLUNTEER_AFFILIATIONS)[number];

export const VOLUNTEER_INTERESTS = [
  "events",
  "projects",
  "mentoring",
  "skills",
  "outreach",
] as const;
export type VolunteerInterest = (typeof VOLUNTEER_INTERESTS)[number];

export const CONTACT_TOPICS = ["general", "airmen", "giving", "partnering", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const isContactTopic = (value: unknown): value is ContactTopic =>
  CONTACT_TOPICS.includes(value as ContactTopic);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const name = z.string().trim().min(1).max(120);
const email = z.string().trim().pipe(z.email().max(254));

/** Shared by the volunteer form and `POST /api/volunteer`. */
export const volunteerSchema = z.object({
  name,
  email,
  phone: optionalText(40),
  affiliation: z.enum(VOLUNTEER_AFFILIATIONS),
  interests: z.array(z.enum(VOLUNTEER_INTERESTS)).min(1).max(VOLUNTEER_INTERESTS.length),
  availability: optionalText(1000),
});

export type VolunteerInput = z.input<typeof volunteerSchema>;
export type Volunteer = z.output<typeof volunteerSchema>;

/** Fields in page order; keys the error messages and the error summary. */
export const VOLUNTEER_FIELDS = [
  "name",
  "email",
  "phone",
  "affiliation",
  "interests",
  "availability",
] as const satisfies readonly (keyof VolunteerInput)[];

/** Shared by the contact form and `POST /api/contact`. */
export const contactSchema = z.object({
  name,
  email,
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10).max(4000),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactMessage = z.output<typeof contactSchema>;

export const CONTACT_FIELDS = [
  "name",
  "email",
  "topic",
  "message",
] as const satisfies readonly (keyof ContactInput)[];

/** Wraps a form's fields with the request metadata every form endpoint needs. */
export const formRequestSchema = <T extends z.ZodType>(form: T) =>
  z.object({
    form,
    locale: z.enum(routing.locales),
    turnstileToken: z.string().max(2048).optional(),
  });

export const FORM_ERRORS = [
  "invalid",
  "rate_limited",
  "verification_failed",
  "unavailable",
  "failed",
] as const;
export type FormError = (typeof FORM_ERRORS)[number];
