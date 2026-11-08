"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTable } from "@/components/admin/data-table";
import { InviteNotice } from "@/components/admin/invite-notice";
import { ChangeRoleDialog, RemoveAccessDialog } from "@/components/admin/team-dialogs";
import { createTeamColumns } from "@/config/columns/team";
import { useColumnTools } from "@/hooks/use-column-tools";
import { type TeamNotice, useTeamActions } from "@/hooks/use-team-actions";
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
    notice.kind === "roleChanged"
      ? t("team.notices.roleChanged", {
          name: notice.name,
          role: t(`roles.${notice.role}.name`),
        })
      : t(`team.notices.${notice.kind}`, { name: notice.name });

  return (
    <p role="status" className="inline-flex items-center gap-2 text-sm">
      <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
      {message}
    </p>
  );
};

type TeamTableProps = { members: AdminTeamRow[]; currentUserId: number };

/** Everyone with back-office access. Role and access changes live in each row's actions. */
export const TeamTable = ({ members, currentUserId }: TeamTableProps) => {
  const tools = useColumnTools();
  const team = useTeamActions();

  const columns = createTeamColumns(tools, {
    currentUserId,
    pendingId: team.pendingId,
    onChangeRole: (member) => team.openDialog("role", member),
    onResendInvite: team.resendInvite,
    onRemoveAccess: (member) => team.openDialog("removeAccess", member),
    onRestoreAccess: team.restoreAccess,
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
        member={team.dialog?.kind === "role" ? team.dialog.member : null}
        onClose={team.closeDialog}
        onSave={team.changeRole}
      />
      <RemoveAccessDialog
        member={team.dialog?.kind === "removeAccess" ? team.dialog.member : null}
        onClose={team.closeDialog}
        onConfirm={team.removeAccess}
      />
    </div>
  );
};
