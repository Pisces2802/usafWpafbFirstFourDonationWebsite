"use client";

import { useEffect, useState } from "react";

import { beginTwoFactorSetup } from "@/lib/admin/auth/actions";
import type { AuthError } from "@/lib/admin/auth/schema";

type SetupState =
  | { status: "loading" }
  | { status: "ready"; secret: string; qrCode: string }
  | { status: "failed"; error: AuthError | "unknown" };

/**
 * Asks the server for a new authenticator secret when the setup screen opens. It's a server
 * action rather than part of the page render, so prefetching or reloading the page never
 * creates a secret on its own.
 */
export const useTwoFactorSetup = () => {
  const [state, setState] = useState<SetupState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    beginTwoFactorSetup()
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
  }, []);

  return state;
};
