"use client";

import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import { createVolunteerColumns } from "@/config/columns/volunteer";
import { useColumnTools } from "@/hooks/use-column-tools";
import type { AdminVolunteerRow } from "@/lib/admin/queries";

export const VolunteersTable = ({ rows }: { rows: AdminVolunteerRow[] }) => {
  const tools = useColumnTools();
  const { t } = tools;
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <TableSearch id="volunteers-search" value={search} onChange={setSearch} />
      <DataTable
        columns={createVolunteerColumns(tools)}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.name, row.email, row.phone)}
        getRowId={(row) => String(row.id)}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("volunteers.empty")}
      />
    </div>
  );
};
