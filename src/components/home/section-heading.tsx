import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id: string;
  children: ReactNode;
  lead?: ReactNode;
  className?: string;
};

export const SectionHeading = ({ id, children, lead, className }: SectionHeadingProps) => (
  <div className={cn("max-w-3xl", className)}>
    <h2 id={id} className="headline text-4xl md:text-5xl">
      {children}
    </h2>
    {lead && <p className="text-muted-foreground mt-4 text-xl">{lead}</p>}
  </div>
);
