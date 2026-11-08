import { createColumnHelper } from "@tanstack/react-table";
import { Reply } from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminMessageRow } from "@/lib/admin/queries";

import { createColumns, DateTimeCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminMessageRow>();

export function createMessageColumns({ t, tForms }: ColumnTools) {
  return createColumns<AdminMessageRow>({
    columns: column.columns([
      column.accessor("createdAt", {
        header: t("messages.columns.date"),
        sortFn: "datetime",
        cell: (info) => <DateTimeCell date={info.getValue()} />,
      }),
      column.accessor("name", {
        header: t("messages.columns.name"),
        cell: (info) => (
          <span className="flex flex-col">
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-muted-foreground text-xs">{info.row.original.email}</span>
          </span>
        ),
      }),
      column.accessor("topic", {
        header: t("messages.columns.topic"),
        cell: (info) => tForms(`topics.${info.getValue()}`),
      }),
      column.accessor("message", {
        header: t("messages.columns.message"),
        enableSorting: false,
        cell: (info) => <p className="line-clamp-3 max-w-xl">{info.getValue()}</p>,
        meta: { className: "min-w-72 whitespace-normal" },
      }),
    ]),
    actionsLabel: (row) => t("table.actionsFor", { name: row.name }),
    actions: (row) => [
      {
        label: t("actions.reply"),
        icon: Reply,
        href: `mailto:${row.email}?subject=${encodeURIComponent(
          t("actions.replySubject", { topic: tForms(`topics.${row.topic}`) }),
        )}`,
      },
    ],
  });
}
