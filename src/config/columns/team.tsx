import { createColumnHelper } from "@tanstack/react-table";
import { Mail, UserCheck, UserCog, UserX } from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

import { createColumns, DateCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminTeamRow>();

const Badge = ({ className, children }: { className: string; children: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${className}`}>{children}</span>
);

type TeamColumnOptions = {
  currentUserId: number;
  /** The person whose change is saving, so their actions are disabled until it finishes. */
  pendingId: number | null;
  onChangeRole: (member: AdminTeamRow) => void;
  onResendInvite: (member: AdminTeamRow) => void;
  onRemoveAccess: (member: AdminTeamRow) => void;
  onRestoreAccess: (member: AdminTeamRow) => void;
};

/** Everyone with back-office access. Role, invite and access changes are row actions. */
export function createTeamColumns(
  { t }: ColumnTools,
  {
    currentUserId,
    pendingId,
    onChangeRole,
    onResendInvite,
    onRemoveAccess,
    onRestoreAccess,
  }: TeamColumnOptions,
) {
  const isPending = (member: AdminTeamRow) => member.id === pendingId;

  return createColumns<AdminTeamRow>({
    columns: column.columns([
      column.accessor("name", {
        header: t("team.columns.name"),
        cell: (info) => {
          const member = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {member.name}
                {member.id === currentUserId && (
                  <Badge className="bg-primary/10 text-primary">{t("team.you")}</Badge>
                )}
                {member.isActive && !member.emailVerifiedAt && (
                  <Badge className="bg-taxiway/15 text-foreground">{t("team.invited")}</Badge>
                )}
                {!member.isActive && (
                  <Badge className="bg-muted text-muted-foreground">{t("team.deactivated")}</Badge>
                )}
                {isPending(member) && (
                  <Badge className="bg-muted text-muted-foreground">{t("team.saving")}</Badge>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{member.email}</span>
            </span>
          );
        },
      }),
      column.accessor("role", {
        header: t("team.columns.role"),
        cell: (info) => t(`roles.${info.getValue()}.name`),
      }),
      column.accessor("lastSignInAt", {
        header: t("team.columns.lastSignIn"),
        sortFn: "datetime",
        cell: (info) => {
          const value = info.getValue();
          return value ? (
            <DateCell date={value} />
          ) : (
            <span className="text-muted-foreground">{t("team.never")}</span>
          );
        },
      }),
    ]),
    actionsLabel: (member) => t("table.actionsFor", { name: member.name }),
    actions: (member) => {
      const isSelf = member.id === currentUserId;
      return [
        {
          label: t("team.changeRole"),
          icon: UserCog,
          hidden: !member.isActive,
          disabled: isPending,
          onClick: onChangeRole,
        },
        {
          label: t("team.resendInvite"),
          icon: Mail,
          hidden: !member.isActive || Boolean(member.emailVerifiedAt),
          disabled: isPending,
          onClick: onResendInvite,
        },
        {
          label: t("team.removeAccess"),
          icon: UserX,
          variant: "destructive",
          hidden: !member.isActive || isSelf,
          disabled: isPending,
          onClick: onRemoveAccess,
        },
        {
          label: t("team.restoreAccess"),
          icon: UserCheck,
          variant: "success",
          hidden: member.isActive,
          disabled: isPending,
          onClick: onRestoreAccess,
        },
      ];
    },
  });
}
