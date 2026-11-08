import { createColumnHelper } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { useAuditLabels } from "@/hooks/use-audit-labels";
import type { ColumnTools } from "@/hooks/use-column-tools";
import { auditCategory } from "@/lib/admin/audit-actions";
import type { AuditEventRow } from "@/lib/admin/audit";

import { createColumns, DateTimeCell, TextCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AuditEventRow>();

const BADGE: Record<string, string> = {
  auth: "bg-sky-500/15 text-sky-300",
  account: "bg-violet-500/15 text-violet-300",
  team: "bg-emerald-500/15 text-emerald-300",
  data: "bg-orange-500/15 text-orange-300",
  platform: "bg-rose-500/15 text-rose-300",
};

/** The audit log. Entries can't be changed, so there are no row actions. */
export function createAuditColumns({ t }: ColumnTools, labels: ReturnType<typeof useAuditLabels>) {
  return createColumns<AuditEventRow>({
    columns: column.columns([
      column.accessor("createdAt", {
        header: t("audit.columns.when"),
        sortFn: "datetime",
        cell: (info) => <DateTimeCell date={info.getValue()} />,
      }),
      column.accessor((row) => row.actorName ?? "", {
        id: "actor",
        header: t("audit.columns.who"),
        cell: (info) => {
          const row = info.row.original;
          if (!row.actorName) {
            return <span className="text-muted-foreground">{labels.actor(row)}</span>;
          }
          return (
            <div className="flex flex-col">
              <span className="font-medium">{row.actorName}</span>
              <span className="text-muted-foreground text-xs">{row.actorEmail}</span>
            </div>
          );
        },
      }),
      column.accessor("action", {
        header: t("audit.columns.action"),
        cell: (info) => {
          const action = info.getValue();
          const group = auditCategory(action);
          return (
            <div className="flex flex-col items-start gap-1">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  BADGE[group] ?? "bg-muted text-muted-foreground",
                )}
              >
                {labels.category(group)}
              </span>
              <span>{labels.action(action)}</span>
            </div>
          );
        },
      }),
      column.accessor((row) => row.targetLabel ?? "", {
        id: "target",
        header: t("audit.columns.target"),
        cell: (info) => <TextCell value={info.getValue()} />,
        meta: { className: "min-w-48 whitespace-normal break-words" },
      }),
      column.accessor((row) => labels.details(row), {
        id: "details",
        header: t("audit.columns.details"),
        enableSorting: false,
        cell: (info) => <TextCell value={info.getValue()} />,
        meta: { className: "min-w-56 whitespace-normal" },
      }),
      column.accessor((row) => row.ip ?? "", {
        id: "ip",
        header: t("audit.columns.ip"),
        enableSorting: false,
        cell: (info) => <TextCell value={info.getValue()} className="font-mono text-xs" />,
      }),
    ]),
  });
}
