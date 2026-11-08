"use client";

import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import { createDonationColumns } from "@/config/columns/fund";
import { useColumnTools } from "@/hooks/use-column-tools";
import type { AdminDonationRow } from "@/lib/admin/queries";

type DonationsTableProps = {
  rows: AdminDonationRow[];
  isCompact?: boolean;
};

/** Gifts with donor, fund and status. `isCompact` drops search and paging for the dashboard. */
export const DonationsTable = ({ rows, isCompact = false }: DonationsTableProps) => {
  const tools = useColumnTools();
  const { t } = tools;
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {!isCompact && <TableSearch id="donations-search" value={search} onChange={setSearch} />}
      <DataTable
        columns={createDonationColumns(tools)}
        data={rows}
        search={search}
        searchFn={(row, query) =>
          matchesQuery(
            query,
            row.donorFirstName,
            row.donorLastName,
            row.donorEmail,
            row.honoreeName,
          )
        }
        getRowId={(row) => String(row.id)}
        pageSize={isCompact ? Math.max(rows.length, 1) : undefined}
        caption={isCompact ? undefined : (count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("donations.empty")}
      />
    </div>
  );
};
