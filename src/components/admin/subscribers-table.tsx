"use client";

import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import { createSubscriberColumns } from "@/config/columns/subscriber";
import { useColumnTools } from "@/hooks/use-column-tools";
import type { AdminSubscriberRow } from "@/lib/admin/queries";

export const SubscribersTable = ({ rows }: { rows: AdminSubscriberRow[] }) => {
  const tools = useColumnTools();
  const { t } = tools;
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <TableSearch
        id="subscribers-search"
        value={search}
        onChange={setSearch}
        placeholder={t("subscribers.searchPlaceholder")}
      />
      <DataTable
        columns={createSubscriberColumns(tools)}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.email)}
        getRowId={(row) => String(row.id)}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("subscribers.empty")}
      />
    </div>
  );
};
