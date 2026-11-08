"use client";

import { useState, useTransition } from "react";

import type { AdminRole } from "@/lib/admin/permissions";
import { changeAdminUserRole, resendInvite, setAdminUserAccess } from "@/lib/admin/team-actions";
import type { TeamError, TeamResult } from "@/lib/admin/team-schema";

/**
 * Role, access and invite changes for one team member. The page re-renders with fresh data when a
 * change saves; a refused change (like removing the last owner) leaves the row as it was and sets
 * `error`. After a resend, `invite` says whether it was emailed, with the link if it wasn't.
 */
export const useTeamMember = (id: number) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<TeamError | "unknown" | null>(null);
  const [invite, setInvite] = useState<{ link: string | null } | null>(null);

  const run = <TData extends object>(
    action: () => Promise<TeamResult<TData>>,
    onDone?: (result: { ok: true } & TData) => void,
  ) =>
    startTransition(async () => {
      setError(null);
      setInvite(null);
      try {
        const result = await action();
        if (!result.ok) setError(result.error);
        else onDone?.(result);
      } catch {
        setError("unknown");
      }
    });

  return {
    isPending,
    error,
    invite,
    changeRole: (role: AdminRole) => run(() => changeAdminUserRole(id, role)),
    setAccess: (isActive: boolean) => run(() => setAdminUserAccess(id, isActive)),
    resend: () =>
      run(
        () => resendInvite(id),
        (result) => setInvite({ link: result.inviteLink }),
      ),
  };
};
