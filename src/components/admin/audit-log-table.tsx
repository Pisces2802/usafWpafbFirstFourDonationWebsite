"use client";

import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { matchesQuery, TableSearch } from "@/components/admin/table-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAuditColumns } from "@/config/columns/audit";
import { useAuditLabels } from "@/hooks/use-audit-labels";
import { useColumnTools } from "@/hooks/use-column-tools";
import { auditCategory } from "@/lib/admin/audit-actions";
import type { AuditEventRow } from "@/lib/admin/audit";

const CATEGORIES = ["all", "auth", "account", "team", "data", "platform"] as const;

export const AuditLogTable = ({ rows }: { rows: AuditEventRow[] }) => {
  const tools = useColumnTools();
  const { t } = tools;
  const labels = useAuditLabels();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const visible =
    category === "all" ? rows : rows.filter((row) => auditCategory(row.action) === category);

  const categoryItems = CATEGORIES.map((value) => ({
    value,
    label: value === "all" ? t("audit.allActivity") : labels.category(value),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TableSearch id="audit-search" value={search} onChange={setSearch} />
        <Select
          items={categoryItems}
          value={category}
          onValueChange={(value) => setCategory(typeof value === "string" ? value : "all")}
        >
          <SelectTrigger aria-label={t("audit.filterLabel")} className="bg-card h-11 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={createAuditColumns(tools, labels)}
        data={visible}
        search={search}
        resetKey={category}
        searchFn={(row, query) =>
          matchesQuery(
            query,
            row.actorName,
            row.actorEmail,
            row.targetLabel,
            row.ip,
            labels.action(row.action),
            labels.details(row),
          )
        }
        getRowId={(row) => String(row.id)}
        caption={(count) => t("rowCount", { count })}
        empty={search || category !== "all" ? t("emptySearch") : t("audit.empty")}
      />
    </div>
  );
};
