"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { type DefaultValues, type FieldValues, type Path, useForm } from "react-hook-form";
import type { z } from "@/lib/zod";

import { useFormSubmission } from "@/hooks/use-form-submission";

type SubmissionFormOptions<TInput extends FieldValues, TOutput, TField extends Path<TInput>> = {
  schema: z.ZodType<TOutput, TInput>;
  fields: readonly TField[];
  endpoint: `/api/${string}`;
  defaultValues: DefaultValues<TInput>;
  requiresTurnstile: boolean;
};

/**
 * React Hook Form wired to a shared Zod schema and a form endpoint. Errors show after the first
 * submit and then update as fields change; a failed submit moves focus to the error summary. On
 * success the form clears and `sent` holds the submitted values for the confirmation message.
 */
export const useSubmissionForm = <
  TInput extends FieldValues,
  TOutput,
  TField extends Path<TInput>,
>({
  schema,
  fields,
  endpoint,
  defaultValues,
  requiresTurnstile,
}: SubmissionFormOptions<TInput, TOutput, TField>) => {
  const submission = useFormSubmission<TOutput>({ endpoint, requiresTurnstile });
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const focusedFor = useRef(0);
  const [sent, setSent] = useState<TOutput | null>(null);

  const { register, handleSubmit, setValue, reset, formState } = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  // React Hook Form renders the errors (and so the summary) a render after the failed submit, so
  // focus moves on the first render where the summary exists, once per failed submit.
  useEffect(() => {
    if (failedSubmits === focusedFor.current || !summaryRef.current) return;
    focusedFor.current = failedSubmits;
    summaryRef.current.focus();
  });

  const invalidFields = fields.filter((field) => field in formState.errors);

  const submit = handleSubmit(
    async (values) => {
      if (await submission.send(values)) {
        setSent(values);
        reset(defaultValues);
      }
    },
    () => setFailedSubmits((count) => count + 1),
  );

  const startOver = () => {
    setSent(null);
    submission.reset();
  };

  return {
    register,
    setValue,
    submit,
    invalidFields,
    summaryRef,
    status: submission.status,
    sent,
    startOver,
    turnstileRef: submission.turnstileRef,
    setTurnstileToken: submission.setTurnstileToken,
  };
};
