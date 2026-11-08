/**
 * Everything the audit log records. Each name is also its message key under
 * `Admin.audit.actions`, so `auth.signed_in` reads from `audit.actions.auth.signed_in`.
 */
export const AUDIT_ACTIONS = [
  "auth.signed_in",
  "auth.sign_in_failed",
  "auth.sign_in_locked",
  "auth.two_factor_failed",
  "auth.signed_out",
  "auth.invite_accepted",
  "auth.password_reset",
  "auth.two_factor_enabled",
  "account.name_changed",
  "account.password_changed",
  "account.recovery_codes_regenerated",
  "account.other_sessions_ended",
  "account.notifications_changed",
  "account.preferences_changed",
  "team.invited",
  "team.invite_resent",
  "team.role_changed",
  "team.access_removed",
  "team.access_restored",
  "team.updated_from_cli",
  "data.exported",
  "campaign.created",
  "campaign.updated",
  "campaign.deleted",
  "fund.turned_on",
  "fund.turned_off",
  "fund.reordered",
  "platform.settings_changed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const isAuditAction = (value: string): value is AuditAction =>
  AUDIT_ACTIONS.includes(value as AuditAction);

/** The group an action belongs to, shown as a badge and used to filter the log. */
export const auditCategory = (action: string) => action.split(".")[0] ?? "other";
