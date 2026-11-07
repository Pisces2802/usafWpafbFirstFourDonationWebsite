"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";

import { FORM_ERRORS, type FormError } from "@/lib/form-schemas";

export type FormStatus = "idle" | "verifying" | "sending" | "sent" | FormError;

const isFormError = (value: unknown): value is FormError =>
  FORM_ERRORS.includes(value as FormError);

const postForm = async (endpoint: string, body: unknown): Promise<FormError | null> => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return isFormError(data?.error) ? data.error : "failed";
  } catch {
    return "failed";
  }
};

/**
 * Posts a validated form to one of the form endpoints with the active locale and, when the site
 * has Turnstile keys, a fresh token. Tokens are single use, so the widget resets after each try.
 */
export const useFormSubmission = <T>({
  endpoint,
  requiresTurnstile,
}: {
  endpoint: `/api/${string}`;
  requiresTurnstile: boolean;
}) => {
  const locale = useLocale();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus>("idle");

  const send = async (form: T) => {
    if (status === "sending") return false;
    if (requiresTurnstile && !turnstileToken) {
      setStatus("verifying");
      return false;
    }

    setStatus("sending");
    const error = await postForm(endpoint, {
      form,
      locale,
      turnstileToken: turnstileToken ?? undefined,
    });

    if (requiresTurnstile) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }

    setStatus(error ?? "sent");
    return error === null;
  };

  return {
    status,
    send,
    reset: () => setStatus("idle"),
    turnstileRef,
    setTurnstileToken,
  };
};
