"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { DataTable, type DataTableFeatures } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import { isFundId } from "@/config/donation";
import type { AdminDonationRow } from "@/lib/admin/queries";
import { MONEY_FORMAT } from "@/lib/money";

const column = createColumnHelper<DataTableFeatures, AdminDonationRow>();

type DonationsTableProps = {
  rows: AdminDonationRow[];
  isCompact?: boolean;
};

/** Gifts with donor, fund and status. `isCompact` drops search and paging for the dashboard. */
export const DonationsTable = ({ rows, isCompact = false }: DonationsTableProps) => {
  const t = useTranslations("Admin");
  const tFunds = useTranslations("Funds");
  const format = useFormatter();
  const [search, setSearch] = useState("");
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);
  const optionalMoney = (cents: number) => (cents > 0 ? money(cents) : t("values.none"));

  const columns = column.columns([
    column.accessor("createdAt", {
      header: t("donations.columns.date"),
      sortFn: "datetime",
      cell: (info) => format.dateTime(info.getValue(), { dateStyle: "medium" }),
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
      cell: (info) => info.getValue() ?? t("values.none"),
    }),
    column.accessor("status", {
      header: t("donations.columns.status"),
      cell: (info) => t(`values.status.${info.getValue()}`),
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {!isCompact && <TableSearch id="donations-search" value={search} onChange={setSearch} />}
      <DataTable
        columns={columns}
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
        pageSize={isCompact ? Math.max(rows.length, 1) : 25}
        caption={isCompact ? undefined : (count) => t("rowCount", { count })}
        empty={search ? t("emptySearch") : t("donations.empty")}
      />
    </div>
  );
};
