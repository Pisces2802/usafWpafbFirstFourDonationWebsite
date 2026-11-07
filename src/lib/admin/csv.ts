export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

const FORMULA_START = /^[=+\-@\t\r]/;

const formatCell = (value: unknown): string => {
  if (value == null) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/**
 * Serialises rows to RFC 4180 CSV with CRLF line endings. Cells that a spreadsheet would run as a
 * formula are prefixed with an apostrophe, because donor names and tribute fields are user input.
 */
export const toCsv = <T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string =>
  [
    columns.map((column) => formatCell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => formatCell(column.value(row))).join(",")),
  ].join("\r\n") + "\r\n";
