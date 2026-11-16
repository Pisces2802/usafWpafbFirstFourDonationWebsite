"use client";

import { useEffect, useState } from "react";

import type { AuthError } from "@/lib/admin/auth/schema";
import { beginAuthenticatorSetup } from "@/lib/admin/auth/two-factor-actions";

type SetupState =
  | { status: "loading" }
  | { status: "ready"; secret: string; qrCode: string }
  | { status: "failed"; error: AuthError | "unknown" };

/**
 * Asks the server for a new authenticator secret when the app step opens. It's a server action
 * rather than part of the page render, so prefetching or reloading the page never creates a
 * secret on its own. `password` is their current password when they're already signed in.
 */
export const useAuthenticatorSetup = (password?: string) => {
  const [state, setState] = useState<SetupState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    beginAuthenticatorSetup(password)
      .then((result) => {
        if (cancelled) return;
        setState(
          result.ok
            ? { status: "ready", secret: result.secret, qrCode: result.qrCode }
            : { status: "failed", error: result.error },
        );
      })
      .catch(() => !cancelled && setState({ status: "failed", error: "unknown" }));
    return () => {
      cancelled = true;
    };
  }, [password]);

  return state;
};
