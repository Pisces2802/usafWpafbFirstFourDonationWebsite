"use client";

import { cn } from "cn";
import { type KeyboardEvent, useRef } from "react";

import { Option } from "@/types/app";

interface Props {
  onTabChange: (tab: string) => void;
  tab: string;
  tabs: Option[];
  className?: string;
  /** Names the tab list for screen readers. */
  label?: string;
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Tabs that pair with `TabPanel` (ids `tab-{value}` and `tabpanel-{value}`). Arrow keys move
 * between enabled tabs, Home and End jump to the ends, and only the selected tab is in the tab
 * order.
 */
export function TabList({ onTabChange, tab, tabs, className, label }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = tabs.filter((t) => !t.disabled);

  const select = (value: string) => {
    onTabChange(value);
    listRef.current?.querySelector<HTMLButtonElement>(`#tab-${CSS.escape(value)}`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const index = enabled.findIndex((t) => t.value === tab);
    let next: Option | undefined;
    if (event.key in STEP)
      next = enabled[(index + STEP[event.key]! + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled.at(-1);
    if (!next) return;
    event.preventDefault();
    select(next.value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "bg-muted flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg p-1",
        className,
      )}
    >
      {tabs.map((t) => {
        const isSelected = t.value === tab;
        const Icon = t.icon;

        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={isSelected}
            aria-controls={`tabpanel-${t.value}`}
            tabIndex={isSelected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onTabChange(t.value)}
            className={cn(
              "focus-visible:outline-ring flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 disabled:opacity-50",
              isSelected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon aria-hidden="true" className="size-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
