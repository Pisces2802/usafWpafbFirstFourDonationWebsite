"use client";

import { useState, useTransition } from "react";

import {
  changeAdminUserRole,
  lockAccount,
  resendInvite,
  resetTwoFactor,
  setAdminUserAccess,
  signOutEverywhere,
  unlockAccount,
} from "@/lib/admin/team-actions";
import type { TeamError, TeamResult } from "@/lib/admin/team-schema";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

/** What happened after the last change, shown above the team table. */
export type TeamNotice =
  | { kind: "error"; error: TeamError | "unknown" }
  | { kind: "invite"; name: string; link: string | null }
  | { kind: "roleChanged" | "superAdminTransferred"; name: string; role: string }
  | {
      kind:
        "accessRemoved" | "accessRestored" | "twoFactorReset" | "locked" | "unlocked" | "signedOut";
      name: string;
    };

/** Which dialog is open, and for whom. */
export type TeamDialogKind =
  "role" | "removeAccess" | "resetTwoFactor" | "lock" | "unlock" | "signOut" | "handOver";
export type TeamDialog = { kind: TeamDialogKind; member: AdminTeamRow } | null;

/**
 * The Team table's row actions. One change runs at a time; the page re-renders with fresh data
 * when it saves, and `notice` says what happened (or why it was refused, like demoting the last
 * SuperAdmin).
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
    setDialog(null);
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

  const simple =
    (
      kind: Exclude<
        TeamNotice["kind"],
        "error" | "invite" | "roleChanged" | "superAdminTransferred"
      >,
      action: (id: number) => Promise<TeamResult>,
    ) =>
    (member: AdminTeamRow) =>
      run(
        member,
        () => action(member.id),
        () => ({ kind, name: member.name }),
      );

  return {
    pendingId: isPending ? pendingId : null,
    notice,
    dismissNotice: () => setNotice(null),
    dialog,
    openDialog: (kind: TeamDialogKind, member: AdminTeamRow) => setDialog({ kind, member }),
    closeDialog: () => setDialog(null),
    changeRole: (member: AdminTeamRow, role: { id: number; name: string }) => {
      if (role.id === member.roleId) {
        setDialog(null);
        return;
      }
      run(
        member,
        () => changeAdminUserRole(member.id, role.id),
        () => ({ kind: "roleChanged", name: member.name, role: role.name }),
      );
    },
    lock: (member: AdminTeamRow, reason: string) =>
      run(
        member,
        () => lockAccount(member.id, reason),
        () => ({ kind: "locked", name: member.name }),
      ),
    unlock: simple("unlocked", unlockAccount),
    signOut: simple("signedOut", signOutEverywhere),
    removeAccess: simple("accessRemoved", (id) => setAdminUserAccess(id, false)),
    restoreAccess: simple("accessRestored", (id) => setAdminUserAccess(id, true)),
    resetTwoFactor: simple("twoFactorReset", resetTwoFactor),
    /** The hand-over dialog saves on its own, keeping a wrong password inside it; this closes it. */
    handedOver: (member: AdminTeamRow, role: string) => {
      setDialog(null);
      setNotice({ kind: "superAdminTransferred", name: member.name, role });
    },
    resendInvite: (member: AdminTeamRow) =>
      run(
        member,
        () => resendInvite(member.id),
        (result) => ({ kind: "invite", name: member.name, link: result.inviteLink }),
      ),
  };
};
