"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

type TableSearchProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

export const TableSearch = ({ id, value, onChange }: TableSearchProps) => {
  const t = useTranslations("Admin");

  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor={id} className="sr-only">
        {t("searchLabel")}
      </label>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="border-input bg-card focus-visible:border-primary focus-visible:ring-primary/25 min-h-11 w-full rounded-lg border py-2 pr-3 pl-9 text-base outline-none focus-visible:ring-3"
      />
    </div>
  );
};

/** Case-insensitive match of a query against any of the given fields. */
export const matchesQuery = (query: string, ...fields: (string | null | undefined)[]) => {
  const needle = query.trim().toLowerCase();
  return !needle || fields.some((field) => field?.toLowerCase().includes(needle));
};
