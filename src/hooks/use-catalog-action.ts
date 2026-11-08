"use client";

import { useState, useTransition } from "react";

import type { CatalogError, CatalogResult } from "@/lib/admin/catalog-schema";

/** What happened after the last change: a translated confirmation, or why it was refused. */
export type CatalogNotice =
  { kind: "success"; message: string } | { kind: "error"; error: CatalogError | "unknown" };

/**
 * Runs one campaign or fund change at a time. `pendingKey` names what's saving so its controls can
 * show it; the page re-renders with fresh data when the change saves.
 */
export const useCatalogAction = () => {
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<CatalogNotice | null>(null);

  const run = (key: string, action: () => Promise<CatalogResult>, success: string) => {
    setPendingKey(key);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(
          result.ok
            ? { kind: "success", message: success }
            : { kind: "error", error: result.error },
        );
      } catch {
        setNotice({ kind: "error", error: "unknown" });
      } finally {
        setPendingKey(null);
      }
    });
  };

  return {
    run,
    isPending,
    pendingKey: isPending ? pendingKey : null,
    notice,
    setNotice,
  };
};
