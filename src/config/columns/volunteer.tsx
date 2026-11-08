import { createColumnHelper } from "@tanstack/react-table";
import { Mail } from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminVolunteerRow } from "@/lib/admin/queries";
import { VOLUNTEER_INTERESTS, type VolunteerInterest } from "@/lib/form-schemas";

import { createColumns, DateCell, TextCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminVolunteerRow>();

const isInterest = (value: string): value is VolunteerInterest =>
  VOLUNTEER_INTERESTS.includes(value as VolunteerInterest);

export function createVolunteerColumns({ t, tForms }: ColumnTools) {
  return createColumns<AdminVolunteerRow>({
    columns: column.columns([
      column.accessor("createdAt", {
        header: t("volunteers.columns.date"),
        sortFn: "datetime",
        cell: (info) => <DateCell date={info.getValue()} />,
      }),
      column.accessor("name", {
        header: t("volunteers.columns.name"),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      column.accessor("email", { header: t("volunteers.columns.email") }),
      column.accessor("phone", {
        header: t("volunteers.columns.phone"),
        cell: (info) => <TextCell value={info.getValue()} />,
      }),
      column.accessor("affiliation", {
        header: t("volunteers.columns.affiliation"),
        cell: (info) => {
          const value = info.getValue();
          return <TextCell value={value && tForms(`affiliations.${value}`)} />;
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
        cell: (info) => <TextCell value={info.getValue()} />,
        meta: { className: "min-w-48 whitespace-normal" },
      }),
    ]),
    actionsLabel: (row) => t("table.actionsFor", { name: row.name }),
    actions: (row) => [{ label: t("actions.email"), icon: Mail, href: `mailto:${row.email}` }],
  });
}
