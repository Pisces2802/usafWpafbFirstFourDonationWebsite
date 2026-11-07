"use client";

import { useEffect } from "react";

import { useSubmissionForm } from "@/hooks/use-submission-form";
import {
  CONTACT_FIELDS,
  type ContactInput,
  contactSchema,
  isContactTopic,
} from "@/lib/form-schemas";

const DEFAULT_VALUES: ContactInput = { name: "", email: "", topic: "general", message: "" };

/**
 * The contact form on /contact, posting to `POST /api/contact`. A `?topic=` link (for example
 * from the large-gift message or the Airmen call to action) preselects the topic.
 */
export const useContactForm = ({ requiresTurnstile }: { requiresTurnstile: boolean }) => {
  const form = useSubmissionForm({
    schema: contactSchema,
    fields: CONTACT_FIELDS,
    endpoint: "/api/contact",
    defaultValues: DEFAULT_VALUES,
    requiresTurnstile,
  });
  const { setValue } = form;

  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (isContactTopic(topic)) setValue("topic", topic);
  }, [setValue]);

  return form;
};
