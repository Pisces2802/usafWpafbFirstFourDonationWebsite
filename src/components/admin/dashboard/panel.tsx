import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PanelProps = {
  id: string;
  title: ReactNode;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** A titled dashboard card. `id` names the heading so the section is labelled for screen readers. */
export const Panel = ({ id, title, icon: Icon, action, className, children }: PanelProps) => (
  <section
    aria-labelledby={id}
    className={cn(
      "bg-card ring-foreground/10 flex flex-col gap-5 rounded-2xl p-5 ring-1",
      className,
    )}
  >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-accent text-primary flex size-9 items-center justify-center rounded-full">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);
