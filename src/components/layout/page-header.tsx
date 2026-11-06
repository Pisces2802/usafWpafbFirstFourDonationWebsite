import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
};

export const PageHeader = ({ title, lead, children }: PageHeaderProps) => (
  <header className="surface-night">
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:py-24">
      <h1 className="headline text-5xl sm:max-w-[18ch] lg:text-7xl">{title}</h1>
      {lead && <p className="text-muted-foreground mt-6 max-w-2xl text-xl">{lead}</p>}
      {children}
    </div>
  </header>
);
