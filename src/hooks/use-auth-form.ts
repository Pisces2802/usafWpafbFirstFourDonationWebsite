"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type DefaultValues, type FieldValues, type Path, useForm } from "react-hook-form";
import type { z } from "zod";

import type { AuthError, AuthResult } from "@/lib/admin/auth/schema";

type AuthFormOptions<TInput extends FieldValues, TOutput, TData extends object> = {
  schema: z.ZodType<TOutput, TInput>;
  defaultValues: DefaultValues<TInput>;
  action: (values: TOutput) => Promise<AuthResult<TData>>;
  /** Runs on success instead of following `next`, e.g. to show recovery codes first. */
  onSuccess?: (result: { ok: true; next?: string } & TData, values: TOutput) => void;
};

/**
 * A back-office auth form: React Hook Form with a shared Zod schema, a server action, and an
 * error message for anything the server refuses. On success it goes to the `next` path the
 * action returns, unless `onSuccess` takes over.
 */
export const useAuthForm = <TInput extends FieldValues, TOutput, TData extends object = object>({
  schema,
  defaultValues,
  action,
  onSuccess,
}: AuthFormOptions<TInput, TOutput, TData>) => {
  const router = useRouter();
  const [error, setError] = useState<AuthError | "unknown" | null>(null);
  const form = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await action(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (onSuccess) onSuccess(result, values);
      else if (result.next) router.replace(result.next);
    } catch {
      setError("unknown");
    }
  });

  /** The `Admin.auth.errors` key for a field's error, or undefined when it's valid. */
  const fieldError = (field: Path<TInput>) => {
    const message = form.getFieldState(field, form.formState).error?.message;
    return message || undefined;
  };

  return {
    register: form.register,
    reset: form.reset,
    submit,
    fieldError,
    error,
    isSubmitting: form.formState.isSubmitting,
    isSubmitSuccessful: form.formState.isSubmitSuccessful && !error,
  };
};
