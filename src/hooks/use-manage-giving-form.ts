"use client";

import { useSyncExternalStore } from "react";

import { useSubmissionForm } from "@/hooks/use-submission-form";
import {
  MANAGE_GIVING_FIELDS,
  type ManageGivingInput,
  manageGivingSchema,
} from "@/lib/form-schemas";

const DEFAULT_VALUES: ManageGivingInput = { email: "" };

const LINK_PROBLEMS = ["expired", "failed"] as const;
type LinkProblem = (typeof LINK_PROBLEMS)[number];

const subscribeToNothing = () => () => {};

/** The `?link=` reason from the address bar; null on the server and when it isn't one we know. */
const readLinkProblem = (): LinkProblem | null => {
  const reason = new URLSearchParams(window.location.search).get("link");
  return LINK_PROBLEMS.find((problem) => problem === reason) ?? null;
};

/**
 * The email-only form on /manage-giving, posting to `POST /api/manage-giving`. An emailed link
 * that can't be opened comes back here with `?link=expired` or `?link=failed`.
 */
export const useManageGivingForm = ({ requiresTurnstile }: { requiresTurnstile: boolean }) => {
  const form = useSubmissionForm({
    schema: manageGivingSchema,
    fields: MANAGE_GIVING_FIELDS,
    endpoint: "/api/manage-giving",
    defaultValues: DEFAULT_VALUES,
    requiresTurnstile,
  });
  const linkProblem = useSyncExternalStore(subscribeToNothing, readLinkProblem, () => null);

  return { ...form, linkProblem };
};
