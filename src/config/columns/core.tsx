import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { cn } from "cn";

import { ColumnsWithRowClick, DataTableFeatures } from "@/components/admin/data-table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export type Column<T extends RowData> = ColumnDef<DataTableFeatures, T, unknown>;

type TabelActionVariant = "amber" | "default" | "destructive" | "info" | "success" | "warning";

const variants: Record<TabelActionVariant, string> = {
  amber: "text-amber-500 hover:text-amber-600 hover:bg-amber-100/90",
  default: "text-neutral-500 hover:text-neutral-600 hover:bg-neutral-100/90",
  destructive: "text-red-500 hover:text-red-600 hover:bg-red-100/90",
  info: "text-blue-500 hover:text-blue-600 hover:bg-blue-100/90",
  success: "text-green-500 hover:text-green-600 hover:bg-green-100/10",
  warning: "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-100/10",
};

interface TableActionItem<T> {
  label: string;
  icon?: LucideIcon;
  hidden?: boolean | ((args: T) => boolean);
  href?: string | ((args: T) => string);
  onClick?: (args: T) => void;
  disabled?: boolean | ((args: T) => boolean);
  variant?: TabelActionVariant | (string & {});
}

interface CreateColumnsProps<T extends object> {
  columns: Column<T>[];
  actions?: (rowItem: T) => TableActionItem<T>[];
  /** Names the actions button for screen readers, e.g. "Actions for Sam Lee". */
  actionsLabel?: (rowItem: T) => string;
  actionColumnId?: string;
  actionColumnHeader?: string;
  onRowClick?: (row: Row<DataTableFeatures, T>) => void;
  selectable?: boolean;
}

const resolve = <T, V>(value: V | ((args: T) => V) | undefined, args: T): V | undefined =>
  typeof value === "function" ? (value as (args: T) => V)(args) : value;

const isExternal = (href: string) => /^(https?:|mailto:)/.test(href);

const RowActions = <T extends object>({
  row,
  items,
  label,
}: {
  row: T;
  items: TableActionItem<T>[];
  label?: string;
}) => {
  const t = useTranslations("Admin.table");
  const [open, setOpen] = useState(false);
  const visible = items.filter((item) => !resolve(item.hidden, row));
  if (visible.length === 0) return null;

  return (
    <div className="flex justify-end">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={label ?? t("rowActions")}>
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-44 gap-0.5 p-1">
          {visible.map((item, index) => {
            const Icon = item.icon;
            const href = resolve(item.href, row);
            const className = cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              variants[item.variant as TabelActionVariant] ?? variants.default,
            );
            const content = (
              <Fragment>
                {Icon && <Icon className="size-4" />}
                {item.label}
              </Fragment>
            );
            if (href && isExternal(href)) {
              return (
                <a
                  key={index}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noreferrer"
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              );
            }
            return href ? (
              <Link key={index} href={href} className={className} onClick={() => setOpen(false)}>
                {content}
              </Link>
            ) : (
              <Button
                key={index}
                type="button"
                variant="ghost"
                disabled={resolve(item.disabled, row)}
                className={cn(className, "h-auto justify-start font-normal")}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.(row);
                }}
              >
                {content}
              </Button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
};

type CheckboxProps = { checked: boolean | undefined; onCheckedChange: (checked: boolean) => void };

const SelectAllCheckbox = (props: CheckboxProps) => {
  const t = useTranslations("Admin.table");
  return <Checkbox {...props} aria-label={t("selectAll")} />;
};

const SelectRowCheckbox = (props: CheckboxProps) => {
  const t = useTranslations("Admin.table");
  return <Checkbox {...props} aria-label={t("selectRow")} />;
};

export function createColumns<T extends object>({
  columns,
  actions,
  actionsLabel,
  actionColumnId = "actions",
  actionColumnHeader = "",
  onRowClick,
  selectable,
}: CreateColumnsProps<T>): ColumnsWithRowClick<T> {
  const result: Column<T>[] = [];

  if (selectable) {
    result.push({
      id: "select",
      enableSorting: false,
      header: ({ table }) => (
        <SelectAllCheckbox
          checked={
            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && undefined)
          }
          onCheckedChange={(checked: boolean) => table.toggleAllPageRowsSelected(checked)}
        />
      ),
      cell: ({ row }) => (
        <SelectRowCheckbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked: boolean) => row.toggleSelected(checked)}
        />
      ),
    });
  }

  result.push(...columns);

  if (actions) {
    result.push({
      id: actionColumnId,
      header: actionColumnHeader,
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          items={actions(row.original)}
          label={actionsLabel?.(row.original)}
        />
      ),
    });
  }

  const withRowClick = result as ColumnsWithRowClick<T>;
  withRowClick.onRowClick = onRowClick;
  return withRowClick;
}

export const TextCell = ({ value, className }: { value?: string | null; className?: string }) =>
  value?.trim() ? (
    <div className={className}>{value}</div>
  ) : (
    <div className={cn("text-muted-foreground", className)}>—</div>
  );

type DateProps = { date: Date | string | null; className?: string };

const DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

/**
 * Formats in the back-office time zone (the person's choice in Settings, or the site's). en-GB
 * gives the dd/MM/yyyy and 24-hour HH:mm these cells have always shown.
 */
const useZonedFormat = (options: Intl.DateTimeFormatOptions) => {
  const timeZone = useTimeZone();
  return (date: Date | string) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(date));
};

const Empty = ({ className }: { className?: string }) => (
  <div className={cn("text-muted-foreground", className)}>—</div>
);

export const DateCell = ({ date, className }: DateProps) => {
  const format = useZonedFormat(DATE);
  if (!date) return <Empty className={className} />;
  return <div className={className}>{format(date)}</div>;
};

export const TimeCell = ({ date, className }: DateProps) => {
  const format = useZonedFormat(TIME);
  if (!date) return <Empty className={className} />;
  return <div className={className}>{format(date)}</div>;
};

export const DateTimeCell = ({ date, className }: DateProps) => {
  const format = useZonedFormat({ ...DATE, ...TIME });
  if (!date) return <Empty className={className} />;
  return <div className={cn("tabular-nums", className)}>{format(date)}</div>;
};

export const RelativeTimeCell = ({ date, className }: DateProps) => {
  const format = useZonedFormat({ ...DATE, ...TIME });
  if (!date) return <Empty className={className} />;
  return (
    <div title={format(date)} className={className}>
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </div>
  );
};

export const NumberCell = ({ value }: { value: number }) => {
  const format = useFormatter();
  return <span>{format.number(value)}</span>;
};

export const PercentageCell = ({ value, decimals = 1 }: { value: number; decimals?: number }) => {
  return <span>{value.toFixed(decimals)}%</span>;
};

export type StatusVariant =
  "amber" | "danger" | "draft" | "info" | "neutral" | "outline" | "success" | "warning";

const STATUS_DEFAULTS: Record<string, StatusVariant> = {
  active: "success",
  approved: "success",
  completed: "success",
  paid: "success",
  published: "success",
  cancelled: "danger",
  failed: "danger",
  rejected: "danger",
  terminated: "danger",
  draft: "draft",
  "in-progress": "warning",
  inactive: "neutral",
  pending: "warning",
  review: "info",
  suspended: "neutral",
};

export const STATUS_STYLES: Record<StatusVariant, string> = {
  amber: "bg-amber-100 text-amber-600 border-amber-300",
  danger: "bg-red-100 text-red-600 border-red-300",
  draft: "bg-muted text-muted-foreground border-border",
  info: "bg-blue-100 text-blue-600 border-blue-300",
  neutral: "bg-muted text-muted-foreground border-border",
  outline: "bg-transparent text-foreground border-foreground",
  success: "bg-green-100 text-green-600 border-green-300",
  warning: "bg-yellow-100 text-yellow-600 border-yellow-300",
};

interface StatusCellProps<TStatus extends string> {
  status: TStatus;
  /** Translated text to show; the raw status is still used to pick the colour. */
  label?: string;

  className?: string;
  config?: Partial<Record<TStatus, StatusVariant>>;

  default?: StatusVariant;
}

const toReadableStatus = (status: string): string =>
  status
    .replace(/-/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();

export const StatusCell = <TStatus extends string>({
  status,
  label,
  className,
  config,
  default: fallback = "neutral",
}: StatusCellProps<TStatus>) => {
  const map: Record<string, StatusVariant> = config
    ? { ...STATUS_DEFAULTS, ...config }
    : STATUS_DEFAULTS;
  const variant = map[status?.toLowerCase()] ?? fallback;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[variant],
        className,
      )}
    >
      {label ?? (status ? toReadableStatus(status) : status)}
    </span>
  );
};

export const SerialNumberCell = <T extends RowData>({
  row,
}: {
  row: Row<DataTableFeatures, T>;
}) => <span>{row.index + 1}</span>;
