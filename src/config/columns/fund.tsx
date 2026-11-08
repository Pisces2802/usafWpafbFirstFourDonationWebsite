import { createColumnHelper } from "@tanstack/react-table";
import { Mail } from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import { isFundId } from "@/config/donation";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminDonationRow } from "@/lib/admin/queries";

import { createColumns, DateCell, StatusCell, TextCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminDonationRow>();

/** Gifts: date, donor, amounts, fund, campaign and status. */
export function createDonationColumns({ t, tFunds, money }: ColumnTools) {
  const optionalMoney = (cents: number) => (cents > 0 ? money(cents) : t("values.none"));

  return createColumns<AdminDonationRow>({
    columns: column.columns([
      column.accessor("createdAt", {
        header: t("donations.columns.date"),
        sortFn: "datetime",
        cell: (info) => <DateCell date={info.getValue()} />,
      }),
      column.accessor((row) => `${row.donorFirstName} ${row.donorLastName}`, {
        id: "donor",
        header: t("donations.columns.donor"),
        cell: (info) => (
          <span className="flex flex-col">
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-muted-foreground text-xs">{info.row.original.donorEmail}</span>
          </span>
        ),
      }),
      column.accessor("amountCents", {
        header: t("donations.columns.amount"),
        meta: { align: "right" },
        cell: (info) => money(info.getValue()),
      }),
      column.accessor("feeCoveredCents", {
        header: t("donations.columns.fee"),
        meta: { align: "right" },
        cell: (info) => optionalMoney(info.getValue()),
      }),
      column.accessor("refundedCents", {
        header: t("donations.columns.refunded"),
        meta: { align: "right" },
        cell: (info) => optionalMoney(info.getValue()),
      }),
      column.accessor("frequency", {
        header: t("donations.columns.frequency"),
        cell: (info) => t(`values.frequency.${info.getValue()}`),
      }),
      column.accessor("fund", {
        header: t("donations.columns.fund"),
        cell: (info) => {
          const fund = info.getValue();
          return isFundId(fund) ? tFunds(`${fund}.name`) : fund;
        },
      }),
      column.accessor("campaign", {
        header: t("donations.columns.campaign"),
        cell: (info) => <TextCell value={info.getValue()} />,
      }),
      column.accessor("status", {
        header: t("donations.columns.status"),
        cell: (info) => (
          <StatusCell
            status={info.getValue()}
            label={t(`values.status.${info.getValue()}`)}
            config={{ succeeded: "success", refunded: "warning", failed: "danger" }}
          />
        ),
      }),
    ]),
    actionsLabel: (row) =>
      t("table.actionsFor", { name: `${row.donorFirstName} ${row.donorLastName}` }),
    actions: (row) => [
      { label: t("actions.emailDonor"), icon: Mail, href: `mailto:${row.donorEmail}` },
    ],
  });
}
