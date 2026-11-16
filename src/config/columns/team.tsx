import { createColumnHelper } from "@tanstack/react-table";
import {
  Crown,
  KeyRound,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";

import type { DataTableFeatures } from "@/components/admin/data-table";
import type { ColumnTools } from "@/hooks/use-column-tools";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

import { createColumns, DateCell } from "./core";

const column = createColumnHelper<DataTableFeatures, AdminTeamRow>();

const Badge = ({ className, children }: { className: string; children: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${className}`}>{children}</span>
);

/** Which row actions the signed-in person's role allows. The server actions check again. */
export type TeamAbilities = {
  create: boolean;
  edit: boolean;
  deactivate: boolean;
  lock: boolean;
  resetTwoFactor: boolean;
  signOut: boolean;
  /** Only the SuperAdmin can hand SuperAdmin to someone else. */
  handOverSuperAdmin: boolean;
};

type TeamColumnOptions = {
  currentUserId: number;
  abilities: TeamAbilities;
  /** Whether they may change this person's account at all (they hold no access you don't). */
  canActOn: (member: AdminTeamRow) => boolean;
  /** The person whose change is saving, so their actions are disabled until it finishes. */
  pendingId: number | null;
  onChangeRole: (member: AdminTeamRow) => void;
  onResendInvite: (member: AdminTeamRow) => void;
  onRemoveAccess: (member: AdminTeamRow) => void;
  onResetTwoFactor: (member: AdminTeamRow) => void;
  onRestoreAccess: (member: AdminTeamRow) => void;
  onLock: (member: AdminTeamRow) => void;
  onUnlock: (member: AdminTeamRow) => void;
  onSignOut: (member: AdminTeamRow) => void;
  onHandOverSuperAdmin: (member: AdminTeamRow) => void;
};

/** Everyone with back-office access. Role, invite, access and security changes are row actions. */
export function createTeamColumns(
  { t }: ColumnTools,
  {
    currentUserId,
    abilities,
    canActOn,
    pendingId,
    onChangeRole,
    onResendInvite,
    onRemoveAccess,
    onResetTwoFactor,
    onRestoreAccess,
    onLock,
    onUnlock,
    onSignOut,
    onHandOverSuperAdmin,
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
                {member.isLocked && (
                  <Badge className="bg-destructive/10 text-destructive">{t("team.locked")}</Badge>
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
      column.accessor("roleName", {
        header: t("team.columns.role"),
      }),
      column.accessor((member) => member.twoFactorMethod ?? "none", {
        id: "twoFactor",
        header: t("team.columns.twoFactor"),
        cell: (info) => {
          const method = info.getValue();
          return (
            <span className={method === "none" ? "text-muted-foreground" : undefined}>
              {t(`team.twoFactorBadge.${method}`)}
            </span>
          );
        },
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
      const allowed = member.id !== currentUserId && canActOn(member);
      return [
        {
          label: t("team.changeRole"),
          icon: UserCog,
          hidden: !allowed || !abilities.edit || !member.isActive,
          disabled: isPending,
          onClick: onChangeRole,
        },
        {
          label: t("team.resendInvite"),
          icon: Mail,
          hidden:
            !allowed || !abilities.create || !member.isActive || Boolean(member.emailVerifiedAt),
          disabled: isPending,
          onClick: onResendInvite,
        },
        {
          label: t("team.signOutEverywhere"),
          icon: LogOut,
          hidden: !allowed || !abilities.signOut || !member.isActive || member.isLocked,
          disabled: isPending,
          onClick: onSignOut,
        },
        {
          label: t("team.resetTwoFactor"),
          icon: KeyRound,
          hidden: !allowed || !abilities.resetTwoFactor || !member.isActive || !member.hasTwoFactor,
          disabled: isPending,
          onClick: onResetTwoFactor,
        },
        {
          label: t("team.lockAccount"),
          icon: Lock,
          variant: "destructive",
          hidden: !allowed || !abilities.lock || member.isLocked,
          disabled: isPending,
          onClick: onLock,
        },
        {
          label: t("team.unlockAccount"),
          icon: LockOpen,
          variant: "success",
          hidden: !allowed || !abilities.lock || !member.isLocked,
          disabled: isPending,
          onClick: onUnlock,
        },
        {
          label: t("team.removeAccess"),
          icon: UserX,
          variant: "destructive",
          hidden: !allowed || !abilities.deactivate || !member.isActive,
          disabled: isPending,
          onClick: onRemoveAccess,
        },
        {
          label: t("team.restoreAccess"),
          icon: UserCheck,
          variant: "success",
          hidden: !allowed || !abilities.deactivate || member.isActive,
          disabled: isPending,
          onClick: onRestoreAccess,
        },
        {
          label: t("team.handOverSuperAdmin"),
          icon: Crown,
          hidden:
            !abilities.handOverSuperAdmin ||
            member.id === currentUserId ||
            !member.isActive ||
            member.isLocked,
          disabled: isPending,
          onClick: onHandOverSuperAdmin,
        },
      ];
    },
  });
}
