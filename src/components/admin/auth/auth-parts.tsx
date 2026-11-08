import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** Title and lead for a sign-in screen. */
export const AuthHeading = ({ title, lead }: { title: ReactNode; lead?: ReactNode }) => (
  <div className="mb-6 flex flex-col gap-2">
    <h1 className="headline text-3xl">{title}</h1>
    {lead && <p className="text-muted-foreground">{lead}</p>}
  </div>
);

/** A server refusal, announced as soon as it appears. */
export const AuthAlert = ({ children }: { children: ReactNode }) =>
  children ? (
    <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
      {children}
    </p>
  ) : null;

/** A confirmation, like "Password changed". */
export const AuthNotice = ({ children }: { children: ReactNode }) => (
  <p role="status" className="bg-primary/10 text-foreground rounded-lg px-3 py-2.5 text-sm">
    {children}
  </p>
);

export const AuthSubmit = ({
  isSubmitting,
  label,
  submittingLabel,
}: {
  isSubmitting: boolean;
  label: ReactNode;
  submittingLabel: ReactNode;
}) => (
  <Button type="submit" size="touch" disabled={isSubmitting} className="w-full">
    {isSubmitting ? submittingLabel : label}
  </Button>
);
