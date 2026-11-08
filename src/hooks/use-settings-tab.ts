"use client";

import { useState } from "react";

/**
 * The open Settings tab, kept in the `?tab=` query so a link (like the one in a security email)
 * can open a tab directly, and reloading stays on it. Falls back to the first available tab.
 */
export const useSettingsTab = <TTab extends string>(
  available: readonly TTab[],
  initial?: string,
) => {
  const [tab, setTab] = useState<TTab>(
    available.includes(initial as TTab) ? (initial as TTab) : available[0]!,
  );

  const changeTab = (value: string) => {
    if (!available.includes(value as TTab)) return;
    setTab(value as TTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url);
  };

  return { tab, changeTab };
};
