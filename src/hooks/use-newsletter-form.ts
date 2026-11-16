"use client";

import { useSubmissionForm } from "@/hooks/use-submission-form";
import { NEWSLETTER_FIELDS, type NewsletterInput, newsletterSchema } from "@/lib/form-schemas";

const DEFAULT_VALUES: NewsletterInput = { email: "" };

/** The newsletter sign-up, posting to `POST /api/newsletter`. */
export const useNewsletterForm = ({ requiresTurnstile }: { requiresTurnstile: boolean }) =>
  useSubmissionForm({
    schema: newsletterSchema,
    fields: NEWSLETTER_FIELDS,
    endpoint: "/api/newsletter",
    defaultValues: DEFAULT_VALUES,
    requiresTurnstile,
  });
