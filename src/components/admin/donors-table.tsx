"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { DataTable, type DataTableFeatures } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import type { AdminDonorRow } from "@/lib/admin/queries";
import { MONEY_FORMAT } from "@/lib/money";

const column = createColumnHelper<DataTableFeatures, AdminDonorRow>();

export const DonorsTable = ({ rows }: { rows: AdminDonorRow[] }) => {
  const t = useTranslations("Admin");
  const format = useFormatter();
  const [search, setSearch] = useState("");

  const columns = column.columns([
    column.accessor((row) => `${row.firstName} ${row.lastName}`, {
      id: "name",
      header: t("donors.columns.name"),
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    column.accessor("email", { header: t("donors.columns.email") }),
    column.accessor("netCents", {
      header: t("donors.columns.net"),
      meta: { align: "right" },
      cell: (info) => format.number(info.getValue() / 100, MONEY_FORMAT),
    }),
    column.accessor("giftCount", {
      header: t("donors.columns.gifts"),
      meta: { align: "right" },
    }),
    column.accessor("lastGiftAt", {
      header: t("donors.columns.lastGift"),
      sortFn: "datetime",
      cell: (info) => {
        const value = info.getValue();
        return value ? format.dateTime(value, { dateStyle: "medium" }) : t("values.none");
      },
    }),
    column.accessor("isMonthly", {
      header: t("donors.columns.monthly"),
      cell: (info) => (info.getValue() ? t("values.yes") : t("values.no")),
    }),
    column.accessor("locale", {
      header: t("donors.columns.language"),
      cell: (info) => info.getValue().toUpperCase(),
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <TableSearch id="donors-search" value={search} onChange={setSearch} />
      <DataTable
        columns={columns}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.firstName, row.lastName, row.email)}
        getRowId={(row) => String(row.id)}
        pageSize={25}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("donors.empty")}
      />
    </div>
  );
};
