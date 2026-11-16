"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTable } from "@/components/admin/data-table";
import { InviteNotice } from "@/components/admin/invite-notice";
import {
  ChangeRoleDialog,
  HandOverSuperAdminDialog,
  LockDialog,
  RemoveAccessDialog,
  ResetTwoFactorDialog,
  SignOutDialog,
  UnlockDialog,
} from "@/components/admin/team-dialogs";
import { createTeamColumns, type TeamAbilities } from "@/config/columns/team";
import { useColumnTools } from "@/hooks/use-column-tools";
import { type TeamNotice, useTeamActions } from "@/hooks/use-team-actions";
import type { AdminRoleRow } from "@/lib/admin/role-queries";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

const Notice = ({ notice }: { notice: TeamNotice }) => {
  const t = useTranslations("Admin");

  if (notice.kind === "error") {
    return (
      <p role="alert" className="text-destructive inline-flex items-center gap-2 text-sm">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        {t(`team.errors.${notice.error}`)}
      </p>
    );
  }

  if (notice.kind === "invite") {
    return (
      <InviteNotice
        link={notice.link}
        message={t(notice.link ? "team.resentNotSent" : "team.resent", { name: notice.name })}
      />
    );
  }

  const message =
    notice.kind === "roleChanged" || notice.kind === "superAdminTransferred"
      ? t(`team.notices.${notice.kind}`, { name: notice.name, role: notice.role })
      : t(`team.notices.${notice.kind}`, { name: notice.name });

  return (
    <p role="status" className="inline-flex items-center gap-2 text-sm">
      <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
      {message}
    </p>
  );
};

type TeamTableProps = {
  members: AdminTeamRow[];
  currentUserId: number;
  abilities: TeamAbilities;
  /** Roles the signed-in person may give out. */
  assignableRoles: AdminRoleRow[];
  /** Every role but SuperAdmin, for the SuperAdmin to pick their own when handing it over. */
  handOverRoles: AdminRoleRow[];
  canActOn: (member: AdminTeamRow) => boolean;
};

/** Everyone with back-office access. Role, access and security changes live in each row's actions. */
export const TeamTable = ({
  members,
  currentUserId,
  abilities,
  assignableRoles,
  handOverRoles,
  canActOn,
}: TeamTableProps) => {
  const tools = useColumnTools();
  const team = useTeamActions();
  const memberIn = (kind: NonNullable<typeof team.dialog>["kind"]) =>
    team.dialog?.kind === kind ? team.dialog.member : null;

  const columns = createTeamColumns(tools, {
    currentUserId,
    abilities,
    canActOn,
    pendingId: team.pendingId,
    onChangeRole: (member) => team.openDialog("role", member),
    onResendInvite: team.resendInvite,
    onRemoveAccess: (member) => team.openDialog("removeAccess", member),
    onResetTwoFactor: (member) => team.openDialog("resetTwoFactor", member),
    onRestoreAccess: team.restoreAccess,
    onLock: (member) => team.openDialog("lock", member),
    onUnlock: (member) => team.openDialog("unlock", member),
    onSignOut: (member) => team.openDialog("signOut", member),
    onHandOverSuperAdmin: (member) => team.openDialog("handOver", member),
  });

  return (
    <div className="flex flex-col gap-4">
      {team.notice && (
        <div aria-live="polite">
          <Notice notice={team.notice} />
        </div>
      )}
      <DataTable
        columns={columns}
        data={members}
        getRowId={(row) => String(row.id)}
        caption={(count) => tools.t("rowCount", { count })}
        empty={tools.t("team.empty")}
      />
      <ChangeRoleDialog
        member={memberIn("role")}
        roles={assignableRoles}
        onClose={team.closeDialog}
        onSave={team.changeRole}
      />
      <RemoveAccessDialog
        member={memberIn("removeAccess")}
        onClose={team.closeDialog}
        onConfirm={team.removeAccess}
      />
      <ResetTwoFactorDialog
        member={memberIn("resetTwoFactor")}
        onClose={team.closeDialog}
        onConfirm={team.resetTwoFactor}
      />
      <LockDialog member={memberIn("lock")} onClose={team.closeDialog} onConfirm={team.lock} />
      <UnlockDialog
        member={memberIn("unlock")}
        onClose={team.closeDialog}
        onConfirm={team.unlock}
      />
      <SignOutDialog
        member={memberIn("signOut")}
        onClose={team.closeDialog}
        onConfirm={team.signOut}
      />
      <HandOverSuperAdminDialog
        member={memberIn("handOver")}
        roles={handOverRoles}
        onClose={team.closeDialog}
        onDone={team.handedOver}
      />
    </div>
  );
};
