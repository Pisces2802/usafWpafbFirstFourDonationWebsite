"use client";

import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import { createDonorColumns } from "@/config/columns/donor";
import { useColumnTools } from "@/hooks/use-column-tools";
import type { AdminDonorRow } from "@/lib/admin/queries";

export const DonorsTable = ({ rows }: { rows: AdminDonorRow[] }) => {
  const tools = useColumnTools();
  const { t } = tools;
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <TableSearch id="donors-search" value={search} onChange={setSearch} />
      <DataTable
        columns={createDonorColumns(tools)}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.firstName, row.lastName, row.email)}
        getRowId={(row) => String(row.id)}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("donors.empty")}
      />
    </div>
  );
};
