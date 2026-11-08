"use client";

import { DateCell, StatusCell } from "@/config/columns/core";
import { isFundId } from "@/config/donation";
import { useColumnTools } from "@/hooks/use-column-tools";
import type { AdminDonationRow } from "@/lib/admin/queries";

/** The latest gifts in a short table: donor, amount, fund, date and status. */
export const RecentGifts = ({ rows }: { rows: AdminDonationRow[] }) => {
  const { t, tFunds, money } = useColumnTools();

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs">
            <th scope="col" className="px-5 pb-3 font-medium">
              {t("donations.columns.donor")}
            </th>
            <th scope="col" className="px-3 pb-3 text-right font-medium">
              {t("donations.columns.amount")}
            </th>
            <th scope="col" className="px-3 pb-3 font-medium">
              {t("donations.columns.fund")}
            </th>
            <th scope="col" className="px-3 pb-3 font-medium">
              {t("donations.columns.date")}
            </th>
            <th scope="col" className="px-5 pb-3 text-right font-medium">
              {t("donations.columns.status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-border border-t">
              <td className="px-5 py-3">
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-accent text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase"
                  >
                    {row.donorFirstName.charAt(0)}
                    {row.donorLastName.charAt(0)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {row.donorFirstName} {row.donorLastName}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">{row.donorEmail}</span>
                  </span>
                </span>
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {money(row.amountCents)}
              </td>
              <td className="px-3 py-3">
                {isFundId(row.fund) ? tFunds(`${row.fund}.name`) : row.fund}
              </td>
              <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">
                <DateCell date={row.createdAt} />
              </td>
              <td className="px-5 py-3 text-right">
                <StatusCell
                  status={row.status}
                  label={t(`values.status.${row.status}`)}
                  config={{ succeeded: "success", refunded: "warning", failed: "danger" }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
