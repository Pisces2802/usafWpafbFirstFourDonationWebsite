"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { addAdminUser } from "@/lib/admin/team-actions";
import {
  ADMIN_USER_FIELDS,
  type AdminUserInput,
  adminUserSchema,
  type AdminUserValues,
  type TeamError,
} from "@/lib/admin/team-schema";

type AdminUserField = (typeof ADMIN_USER_FIELDS)[number];

const DEFAULT_VALUES: AdminUserInput = { name: "", email: "", role: "viewer" };

export type AddedPerson = AdminUserValues & { inviteLink: string | null };

/**
 * The add-person form: validates with the shared schema, calls the server action, and turns a
 * taken email into a field error. Calls `onAdded` once the person is saved, with their set-up
 * link if the invite email couldn't be sent. `clear` resets the form and any error, for when
 * the dialog closes.
 */
export const useAddAdminUserForm = ({ onAdded }: { onAdded: (added: AddedPerson) => void }) => {
  const [error, setError] = useState<TeamError | "unknown" | null>(null);
  const form = useForm<AdminUserInput, unknown, AdminUserValues>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const response = await addAdminUser(values);
      if (response.ok) {
        form.reset(DEFAULT_VALUES);
        onAdded({ ...values, inviteLink: response.inviteLink });
      } else if (response.error === "emailTaken") {
        form.setError("email", { type: "emailTaken" }, { shouldFocus: true });
      } else {
        setError(response.error);
      }
    } catch {
      setError("unknown");
    }
  });

  const clear = () => {
    form.reset(DEFAULT_VALUES);
    setError(null);
  };

  /** The message key for a field's error, or undefined when it's valid. */
  const fieldError = (field: AdminUserField): AdminUserField | "emailTaken" | undefined => {
    const fieldErrorValue = form.formState.errors[field];
    if (!fieldErrorValue) return undefined;
    return fieldErrorValue.type === "emailTaken" ? "emailTaken" : field;
  };

  return {
    register: form.register,
    submit,
    clear,
    isSubmitting: form.formState.isSubmitting,
    fieldError,
    error,
  };
};
