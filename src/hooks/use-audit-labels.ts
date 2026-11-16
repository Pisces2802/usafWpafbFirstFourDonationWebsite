"use client";

import { useTranslations } from "next-intl";

import { isAuditAction } from "@/lib/admin/audit-actions";
import type { AuditEventRow } from "@/lib/admin/audit";

type DetailValue = string | number | boolean | null;

const METHODS = ["authenticator", "recovery_code", "email", "password"] as const;

/** Role names from before roles could be edited, kept so old entries still read well. */
const LEGACY_ROLES = ["owner", "treasurer", "coordinator", "viewer"] as const;
type LegacyRole = (typeof LEGACY_ROLES)[number];
const isLegacyRole = (value: unknown): value is LegacyRole =>
  LEGACY_ROLES.includes(value as LegacyRole);

/**
 * Turns stored audit entries into readable text: action names, categories, who did it when no
 * one was signed in, and a one-line summary of the details.
 */
export const useAuditLabels = () => {
  const t = useTranslations("Admin.audit");
  const tAdmin = useTranslations("Admin");

  const action = (value: string) => (isAuditAction(value) ? t(`actions.${value}`) : value);

  type Key = Parameters<typeof t>[0];

  const category = (value: string) => {
    const key = `categories.${value}` as Key;
    return t.has(key) ? t(key) : value;
  };

  const actor = (row: Pick<AuditEventRow, "action">) =>
    row.action === "team.updated_from_cli" ? t("commandLine") : t("unknownPerson");

  const value = (key: string, detail: DetailValue) => {
    if (detail === null || detail === "") return t("none");
    if (typeof detail === "boolean") return t(detail ? "yes" : "no");
    if (isLegacyRole(detail) && ["from", "to", "role"].includes(key)) {
      return tAdmin(`legacyRoles.${detail}`);
    }
    if (key === "method" && METHODS.includes(detail as (typeof METHODS)[number])) {
      return t(`methods.${detail as (typeof METHODS)[number]}`);
    }
    return String(detail);
  };

  const fieldName = (field: string) => {
    const key = `details.${field}` as Key;
    return t.has(key) ? t(key) : field;
  };

  /** "Viewer → Treasurer" for a change, otherwise "Field: value · Field: value". */
  const details = (row: Pick<AuditEventRow, "details">) => {
    const entries = Object.entries(row.details ?? {}).filter(([key]) => key !== "dataset");
    const record = Object.fromEntries(entries);
    if (entries.length === 2 && "from" in record && "to" in record) {
      return `${value("from", record.from!)} → ${value("to", record.to!)}`;
    }
    return entries.map(([key, detail]) => `${fieldName(key)}: ${value(key, detail)}`).join(" · ");
  };

  return { action, category, actor, details };
};
