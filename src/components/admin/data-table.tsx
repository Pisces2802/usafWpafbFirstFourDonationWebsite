"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { useAdminPreferences } from "@/components/admin/preferences-provider";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  FilterFn,
  PaginationState,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
  Updater,
} from "@tanstack/react-table";

import { Pagination } from "./pagination";

interface DataTableColumnMeta {
  className?: string;
  align?: "left" | "right";
}

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: {} as DataTableColumnMeta,
});

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  !!target.closest(
    'button, a, input, select, textarea, label, [role="menuitem"], [role="checkbox"]',
  );

export type DataTableFeatures = typeof dataTableFeatures;

export type ColumnsWithRowClick<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData,
  unknown
>[] & {
  onRowClick?: (row: Row<DataTableFeatures, TData>) => void;
};

type Features = DataTableFeatures;

interface Props<TData extends RowData> {
  columns: ColumnDef<Features, TData, unknown>[];
  data: TData[];
  search?: string;
  searchFn?: (row: TData, query: string) => boolean;
  resetKey?: string;
  title?: string;
  caption?: (count: number) => ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  /** Rows per page; leave it out to use the person's preference from Settings. */
  pageSize?: number;
  isRowActive?: (row: TData) => boolean;
  getRowId?: (row: TData) => string;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  rowSelection?: RowSelectionState;
  onRowClick?: (row: Row<Features, TData>) => void;
  className?: string;
  tableClassName?: string;
}

const SortIcon = ({ direction }: { direction: false | "asc" | "desc" }) => {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
  return <Icon className={cn("size-3.5", !direction && "text-muted-foreground")} />;
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  search = "",
  searchFn,
  resetKey,
  title,
  caption,
  footer,
  empty = "Nothing matches. Try a different search or filter.",
  loading,
  pageSize: fixedPageSize,
  isRowActive,
  getRowId,
  onRowSelectionChange,
  rowSelection: externalRowSelection,
  onRowClick,
  className,
  tableClassName,
}: Props<TData>) {
  const handleRowClick = onRowClick ?? (columns as Partial<ColumnsWithRowClick<TData>>).onRowClick;

  const [sorting, setSorting] = useState<SortingState>([]);
  const preferences = useAdminPreferences();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: fixedPageSize ?? preferences.pageSize,
  });
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [lastFilter, setLastFilter] = useState([search, resetKey]);

  if (lastFilter[0] !== search || lastFilter[1] !== resetKey) {
    setLastFilter([search, resetKey]);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  const rowSelection = externalRowSelection ?? internalRowSelection;

  const handleRowSelectionChange = (updaterOrValue: Updater<RowSelectionState>) => {
    const next =
      typeof updaterOrValue === "function" ? updaterOrValue(rowSelection) : updaterOrValue;
    if (onRowSelectionChange) onRowSelectionChange(next);
    else setInternalRowSelection(next);
  };

  const globalFilterFn: FilterFn<Features, TData> | "includesString" = searchFn
    ? (row, _columnId, value: string) => searchFn(row.original, value)
    : "includesString";

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    state: { globalFilter: search.trim(), sorting, pagination, rowSelection },
    globalFilterFn,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: handleRowSelectionChange,
  });

  const total = table.getPrePaginatedRowModel().rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));
  if (pagination.pageIndex >= pageCount) {
    setPagination((current) => ({ ...current, pageIndex: pageCount - 1 }));
  }

  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  return (
    <section
      className={cn(
        "border-border bg-card w-full min-w-0 overflow-hidden rounded-[20px] border",
        className,
      )}
    >
      {title && <h2 className="px-5 pt-5 pb-1 text-lg font-semibold sm:text-xl">{title}</h2>}
      {caption && (
        <p className="border-border text-muted-foreground border-b px-5 py-4 text-sm">
          {loading ? "Loading…" : caption(total)}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className={cn("w-full text-left text-sm", tableClassName)}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-border border-b">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const canSort = header.column.getCanSort();
                  const direction = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "px-3 py-3 font-semibold whitespace-nowrap first:pl-5 last:pr-5",
                        meta?.align === "right" && "text-right",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "hover:text-muted-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded px-1 outline-none focus-visible:ring-2",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon direction={direction} />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="border-border border-b last:border-0">
                  <td colSpan={columnCount} className="px-5 py-3">
                    <div className="bg-muted h-9 animate-pulse rounded-lg" />
                  </td>
                </tr>
              ))
            ) : rows.length ? (
              rows.map((row) => {
                const active = isRowActive?.(row.original) ?? false;
                return (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() || active ? "selected" : undefined}
                    className={cn(
                      "data-[state=selected]:bg-brand-soft/40 border-border border-b transition-colors last:border-0",
                      handleRowClick && "hover:bg-muted cursor-pointer",
                    )}
                    {...(handleRowClick
                      ? {
                          tabIndex: 0,
                          "aria-selected": active,
                          onClick: (event: MouseEvent<HTMLTableRowElement>) => {
                            if (!isInteractiveTarget(event.target)) handleRowClick(row);
                          },
                          onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            if (isInteractiveTarget(event.target)) return;
                            event.preventDefault();
                            handleRowClick(row);
                          },
                        }
                      : {})}
                  >
                    {row.getAllCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-3 py-3 align-middle whitespace-nowrap first:pl-5 last:pr-5",
                            meta?.align === "right" && "text-right tabular-nums",
                            meta?.className,
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columnCount} className="text-muted-foreground px-5 py-14 text-center">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
          {footer && !loading && (
            <tfoot className="border-foreground border-t font-semibold">{footer}</tfoot>
          )}
        </table>
      </div>
      {!loading && total > pagination.pageSize && (
        <Pagination
          page={pagination.pageIndex + 1}
          pageSize={pagination.pageSize}
          total={total}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
        />
      )}
    </section>
  );
}
