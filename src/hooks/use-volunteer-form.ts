"use client";

import type { DefaultValues } from "react-hook-form";

import { useSubmissionForm } from "@/hooks/use-submission-form";
import { VOLUNTEER_FIELDS, type VolunteerInput, volunteerSchema } from "@/lib/form-schemas";

const DEFAULT_VALUES: DefaultValues<VolunteerInput> = {
  name: "",
  email: "",
  phone: "",
  affiliation: undefined,
  interests: [],
  availability: "",
};

/** The volunteer sign-up form on /get-involved, posting to `POST /api/volunteer`. */
export const useVolunteerForm = ({ requiresTurnstile }: { requiresTurnstile: boolean }) =>
  useSubmissionForm({
    schema: volunteerSchema,
    fields: VOLUNTEER_FIELDS,
    endpoint: "/api/volunteer",
    defaultValues: DEFAULT_VALUES,
    requiresTurnstile,
  });
