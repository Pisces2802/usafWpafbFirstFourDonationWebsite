import { createColumnHelper } from "@tanstack/react-table";
import { Mail } from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminDonorRow } from "@/lib/admin/queries";

import { createColumns, DateCell, NumberCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminDonorRow>();

export function createDonorColumns({ t, money }: ColumnTools) {
  return createColumns<AdminDonorRow>({
    columns: column.columns([
      column.accessor((row) => `${row.firstName} ${row.lastName}`, {
        id: "name",
        header: t("donors.columns.name"),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      column.accessor("email", { header: t("donors.columns.email") }),
      column.accessor("netCents", {
        header: t("donors.columns.net"),
        meta: { align: "right" },
        cell: (info) => money(info.getValue()),
      }),
      column.accessor("giftCount", {
        header: t("donors.columns.gifts"),
        meta: { align: "right" },
        cell: (info) => <NumberCell value={info.getValue()} />,
      }),
      column.accessor("lastGiftAt", {
        header: t("donors.columns.lastGift"),
        sortFn: "datetime",
        cell: (info) => <DateCell date={info.getValue()} />,
      }),
      column.accessor("isMonthly", {
        header: t("donors.columns.monthly"),
        cell: (info) => (info.getValue() ? t("values.yes") : t("values.no")),
      }),
      column.accessor("locale", {
        header: t("donors.columns.language"),
        cell: (info) => info.getValue().toUpperCase(),
      }),
    ]),
    actionsLabel: (row) => t("table.actionsFor", { name: `${row.firstName} ${row.lastName}` }),
    actions: (row) => [{ label: t("actions.email"), icon: Mail, href: `mailto:${row.email}` }],
  });
}
