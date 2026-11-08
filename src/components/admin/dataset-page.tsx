import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";

import { AdminPage, NoDatabase, TableSkeleton } from "@/components/admin/admin-page";
import { ExportLink } from "@/components/admin/export-link";
import type { AdminDataset } from "@/lib/admin/export";

type DatasetPageProps<T> = {
  dataset: AdminDataset;
  load: () => Promise<T[] | null>;
  render: (rows: T[]) => ReactNode;
};

const Rows = async <T,>({ load, render }: Omit<DatasetPageProps<T>, "dataset">) => {
  const rows = await load();
  return rows ? render(rows) : <NoDatabase />;
};

/**
 * A back-office list page: heading and export link straight away, rows streamed in once the
 * loader (which runs the access check) resolves.
 */
export const DatasetPage = async <T,>({ dataset, load, render }: DatasetPageProps<T>) => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage
      title={t(`nav.${dataset}`)}
      lead={t(`${dataset}.lead`)}
      actions={
        <Suspense>
          <ExportLink dataset={dataset} />
        </Suspense>
      }
    >
      <Suspense fallback={<TableSkeleton />}>
        <Rows load={load} render={render} />
      </Suspense>
    </AdminPage>
  );
};
