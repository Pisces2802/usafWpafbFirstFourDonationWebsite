"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { DataTable, type DataTableFeatures } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import type { AdminMessageRow } from "@/lib/admin/queries";

const column = createColumnHelper<DataTableFeatures, AdminMessageRow>();

export const MessagesTable = ({ rows }: { rows: AdminMessageRow[] }) => {
  const t = useTranslations("Admin");
  const tForms = useTranslations("Forms");
  const format = useFormatter();
  const [search, setSearch] = useState("");

  const columns = column.columns([
    column.accessor("createdAt", {
      header: t("messages.columns.date"),
      sortFn: "datetime",
      cell: (info) => format.dateTime(info.getValue(), { dateStyle: "medium", timeStyle: "short" }),
    }),
    column.accessor("name", {
      header: t("messages.columns.name"),
      cell: (info) => (
        <span className="flex flex-col">
          <span className="font-medium">{info.getValue()}</span>
          <a
            href={`mailto:${info.row.original.email}`}
            className="text-primary text-xs underline-offset-2 hover:underline"
          >
            {info.row.original.email}
          </a>
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
  ]);

  return (
    <div className="flex flex-col gap-4">
      <TableSearch id="messages-search" value={search} onChange={setSearch} />
      <DataTable
        columns={columns}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.name, row.email, row.message)}
        getRowId={(row) => String(row.id)}
        pageSize={25}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("messages.empty")}
      />
    </div>
  );
};
