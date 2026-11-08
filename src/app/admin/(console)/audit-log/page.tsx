import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { loadAuditLog } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("audit");

const AuditLog = async () => {
  const rows = await loadAuditLog();
  return rows ? <AuditLogTable rows={rows} /> : <NoDatabase />;
};

const AuditLogPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.audit")} lead={t("audit.lead")}>
      <Suspense fallback={<TableSkeleton />}>
        <AuditLog />
      </Suspense>
    </AdminPage>
  );
};

export default AuditLogPage;
