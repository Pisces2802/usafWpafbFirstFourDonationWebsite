import { FlaskConical } from "lucide-react";

export const SampleBadge = ({ label }: { label: string }) => (
  <span className="bg-muted text-muted-foreground ring-foreground/10 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1">
    <FlaskConical aria-hidden="true" className="size-3.5" />
    {label}
  </span>
);
