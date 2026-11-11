"use client";

import { useState, useTransition } from "react";

import type { AdminRole } from "@/lib/admin/permissions";
import { changeAdminUserRole, resendInvite, setAdminUserAccess } from "@/lib/admin/team-actions";
import type { TeamError, TeamResult } from "@/lib/admin/team-schema";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

/** What happened after the last change, shown above the team table. */
export type TeamNotice =
  | { kind: "error"; error: TeamError | "unknown" }
  | { kind: "invite"; name: string; link: string | null }
  | { kind: "roleChanged"; name: string; role: AdminRole }
  | { kind: "accessRemoved" | "accessRestored"; name: string };

/** Which dialog is open, and for whom. */
export type TeamDialog = { kind: "role" | "removeAccess"; member: AdminTeamRow } | null;

/**
 * The Team table's row actions. One change runs at a time; the page re-renders with fresh data
 * when it saves, and `notice` says what happened (or why it was refused, like removing the last
 * owner).
 */
export const useTeamActions = () => {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<TeamNotice | null>(null);
  const [dialog, setDialog] = useState<TeamDialog>(null);

  const run = <TData extends object>(
    member: AdminTeamRow,
    action: () => Promise<TeamResult<TData>>,
    done: (result: { ok: true } & TData) => TeamNotice,
  ) => {
    setPendingId(member.id);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result.ok ? done(result) : { kind: "error", error: result.error });
      } catch {
        setNotice({ kind: "error", error: "unknown" });
      } finally {
        setPendingId(null);
      }
    });
  };

  return {
    pendingId: isPending ? pendingId : null,
    notice,
    dismissNotice: () => setNotice(null),
    dialog,
    openDialog: (kind: "role" | "removeAccess", member: AdminTeamRow) =>
      setDialog({ kind, member }),
    closeDialog: () => setDialog(null),
    changeRole: (member: AdminTeamRow, role: AdminRole) => {
      setDialog(null);
      if (role === member.role) return;
      run(
        member,
        () => changeAdminUserRole(member.id, role),
        () => ({ kind: "roleChanged", name: member.name, role }),
      );
    },
    removeAccess: (member: AdminTeamRow) => {
      setDialog(null);
      run(
        member,
        () => setAdminUserAccess(member.id, false),
        () => ({ kind: "accessRemoved", name: member.name }),
      );
    },
    restoreAccess: (member: AdminTeamRow) =>
      run(
        member,
        () => setAdminUserAccess(member.id, true),
        () => ({ kind: "accessRestored", name: member.name }),
      ),
    resendInvite: (member: AdminTeamRow) =>
      run(
        member,
        () => resendInvite(member.id),
        (result) => ({ kind: "invite", name: member.name, link: result.inviteLink }),
      ),
  };
};
