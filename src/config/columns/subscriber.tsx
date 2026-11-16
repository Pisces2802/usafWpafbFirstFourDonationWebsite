import { createColumnHelper } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminSubscriberRow } from "@/lib/admin/queries";

import { createColumns, DateCell, StatusCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminSubscriberRow>();

/** Newsletter sign-ups: email, where they are in confirming, language and dates. */
export function createSubscriberColumns({ t }: ColumnTools) {
  return createColumns<AdminSubscriberRow>({
    columns: column.columns([
      column.accessor("createdAt", {
        header: t("subscribers.columns.date"),
        sortFn: "datetime",
        cell: (info) => <DateCell date={info.getValue()} />,
      }),
      column.accessor("email", {
        header: t("subscribers.columns.email"),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      column.accessor("status", {
        header: t("subscribers.columns.status"),
        cell: (info) => (
          <StatusCell
            status={info.getValue()}
            label={t(`subscribers.status.${info.getValue()}`)}
            config={{ subscribed: "success", pending: "warning", unsubscribed: "neutral" }}
          />
        ),
      }),
      column.accessor((row) => row.unsubscribedAt ?? row.confirmedAt, {
        id: "changed",
        header: t("subscribers.columns.changed"),
        sortFn: "datetime",
        cell: (info) => {
          const date = info.getValue();
          return date ? <DateCell date={date} /> : t("values.none");
        },
      }),
      column.accessor("locale", {
        header: t("subscribers.columns.language"),
        cell: (info) => info.getValue().toUpperCase(),
      }),
    ]),
  });
}
