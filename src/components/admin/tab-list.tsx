import { cn } from "cn";

import { Option } from "@/types/app";

interface Props {
  onTabChange: (tab: string) => void;
  tab: string;
  tabs: Option[];
  className?: string;
}

export function TabList({ onTabChange, tab, tabs, className }: Props) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto", className)}>
      {tabs.map((t) => (
        <button
          className={cn(
            "flex items-center text-center text-sm",
            t.value === tab ? "bg-primary text-white" : "text-muted-foreground",
          )}
          key={t.value}
          onClick={() => onTabChange(t.value)}
          disabled={t.disabled}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
