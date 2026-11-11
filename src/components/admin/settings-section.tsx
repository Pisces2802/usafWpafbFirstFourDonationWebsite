import type { ReactNode } from "react";

type SettingsSectionProps = {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
};

/** One group of settings: a title and explanation on the left, the controls on the right. */
export const SettingsSection = ({ id, title, lead, children }: SettingsSectionProps) => (
  <section
    aria-labelledby={id}
    className="bg-card ring-foreground/10 grid gap-5 rounded-xl p-5 ring-1 lg:grid-cols-[16rem_1fr] lg:gap-8 lg:p-6"
  >
    <div>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {lead && <p className="text-muted-foreground mt-1 text-sm">{lead}</p>}
    </div>
    <div className="min-w-0">{children}</div>
  </section>
);
