"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { DataTable, type DataTableFeatures } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import type { AdminVolunteerRow } from "@/lib/admin/queries";
import { VOLUNTEER_INTERESTS, type VolunteerInterest } from "@/lib/form-schemas";

const column = createColumnHelper<DataTableFeatures, AdminVolunteerRow>();

const isInterest = (value: string): value is VolunteerInterest =>
  VOLUNTEER_INTERESTS.includes(value as VolunteerInterest);

export const VolunteersTable = ({ rows }: { rows: AdminVolunteerRow[] }) => {
  const t = useTranslations("Admin");
  const tForms = useTranslations("Forms");
  const format = useFormatter();
  const [search, setSearch] = useState("");

  const columns = column.columns([
    column.accessor("createdAt", {
      header: t("volunteers.columns.date"),
      sortFn: "datetime",
      cell: (info) => format.dateTime(info.getValue(), { dateStyle: "medium" }),
    }),
    column.accessor("name", {
      header: t("volunteers.columns.name"),
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    column.accessor("email", { header: t("volunteers.columns.email") }),
    column.accessor("phone", {
      header: t("volunteers.columns.phone"),
      cell: (info) => info.getValue() ?? t("values.none"),
    }),
    column.accessor("affiliation", {
      header: t("volunteers.columns.affiliation"),
      cell: (info) => {
        const value = info.getValue();
        return value ? tForms(`affiliations.${value}`) : t("values.none");
      },
    }),
    column.accessor((row) => row.interests.join(", "), {
      id: "interests",
      header: t("volunteers.columns.interests"),
      enableSorting: false,
      cell: (info) =>
        info.row.original.interests
          .map((interest) => (isInterest(interest) ? tForms(`interests.${interest}`) : interest))
          .join(", "),
      meta: { className: "min-w-64 whitespace-normal" },
    }),
    column.accessor("availability", {
      header: t("volunteers.columns.availability"),
      enableSorting: false,
      cell: (info) => info.getValue() ?? t("values.none"),
      meta: { className: "min-w-48 whitespace-normal" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <TableSearch id="volunteers-search" value={search} onChange={setSearch} />
      <DataTable
        columns={columns}
        data={rows}
        search={search}
        searchFn={(row, query) => matchesQuery(query, row.name, row.email, row.phone)}
        getRowId={(row) => String(row.id)}
        pageSize={25}
        caption={(count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("volunteers.empty")}
      />
    </div>
  );
};
