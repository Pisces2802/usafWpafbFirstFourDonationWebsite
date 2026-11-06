"use client";

import { useState } from "react";

export type ShareStatus = "idle" | "copied" | "failed";

/**
 * Shares a link with the system share sheet where there is one, and copies it to the clipboard
 * everywhere else. `status` reports a copy so the button can confirm it.
 */
export const useShare = ({ url, title }: { url: string; title: string }) => {
  const [status, setStatus] = useState<ShareStatus>("idle");

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return { share, status };
};
