"use client";

import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import { createMessageColumns } from "@/config/columns/message";
import { useColumnTools } from "@/hooks/use-column-tools";
import type { AdminMessageRow } from "@/lib/admin/queries";

export const MessagesTable = ({ rows }: { rows: AdminMessageRow[] }) => {
  const tools = useColumnTools();
  const { t } = tools;
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <TableSearch id="messages-search" value={search} onChange={setSearch} />
      <DataTable
        columns={createMessageColumns(tools)}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.name, row.email, row.message)}
        getRowId={(row) => String(row.id)}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("messages.empty")}
      />
    </div>
  );
};
