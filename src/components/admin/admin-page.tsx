import { Database, Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/admin/access";
import type { AdminPermission } from "@/lib/admin/permissions";

type AdminPageProps = {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/** Heading, optional lead and actions, then the page body. */
export const AdminPage = ({ title, lead, actions, children }: AdminPageProps) => (
  <div className="mx-auto flex w-full container flex-col gap-8 px-4 py-8 lg:px-12 lg:py-10">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="headline text-4xl lg:text-5xl">{title}</h1>
        {lead && <p className="text-muted-foreground mt-3 text-lg">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-3">{actions}</div>}
    </div>
    {children}
  </div>
);

/** Shown in place of data when `DATABASE_URL` isn't set. */
export const NoDatabase = async () => {
  const t = await getTranslations("Admin.noDatabase");

  return (
    <div className="bg-card ring-foreground/10 flex gap-4 rounded-xl p-6 ring-1">
      <Database aria-hidden="true" className="text-muted-foreground mt-0.5 size-6 shrink-0" />
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1">{t("body")}</p>
      </div>
    </div>
  );
};

/** Placeholder for a section that's planned but not built yet. */
export const ComingSoon = async ({ plan }: { plan: ReactNode }) => {
  const t = await getTranslations("Admin");

  return (
    <div className="bg-card ring-foreground/10 flex gap-4 rounded-xl p-6 ring-1">
      <Hammer aria-hidden="true" className="text-muted-foreground mt-0.5 size-6 shrink-0" />
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold">{t("comingSoon")}</h2>
        <p className="text-muted-foreground mt-1">{plan}</p>
      </div>
    </div>
  );
};

/** Loading placeholder sized like a data table. */
export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div aria-hidden="true" className="bg-card ring-foreground/10 rounded-xl p-5 ring-1">
    <div className="bg-muted mb-4 h-5 w-40 animate-pulse rounded" />
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="bg-muted h-9 animate-pulse rounded-lg" />
      ))}
    </div>
  </div>
);

/** Renders `children` only for roles with `permission`; everyone else gets the 403 page. */
export const RequirePermission = async ({
  permission,
  children,
}: {
  permission: AdminPermission;
  children: ReactNode;
}) => {
  await requireAdmin(permission);
  return children;
};
