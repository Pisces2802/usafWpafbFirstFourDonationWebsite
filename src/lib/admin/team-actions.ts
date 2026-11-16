"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";

import { type Db, getDb } from "@/db";
import { type AdminUser, requireAdmin } from "@/lib/admin/access";
import { personLabel, recordAudit } from "@/lib/admin/audit";
import { createAuthLink, sendInviteEmail } from "@/lib/admin/auth/links";
import { sendSecurityNotice } from "@/lib/admin/auth/security-email";
import { checkCurrentPassword } from "@/lib/admin/auth/password-check";
import { findAdminById } from "@/lib/admin/auth/queries";
import { type AdminPermission, canGrant, type RoleGrant } from "@/lib/admin/permissions";
import { findRole } from "@/lib/admin/role-queries";
import {
  createAdminUser,
  endAllSessions,
  findTeamMember,
  lockAdminUser,
  resetAdminTwoFactor,
  setAdminUserActive,
  transferSuperAdmin,
  unlockAdminUser,
  updateAdminUserRole,
} from "@/lib/admin/team-queries";
import {
  adminUserSchema,
  type InviteResult,
  lockReasonSchema,
  type TeamResult,
} from "@/lib/admin/team-schema";

const idSchema = z.number().int().positive();

/** See `canGrant`: whether `actor` may give out `role` or act on someone who holds it. */
const covers = (actor: AdminUser, role: RoleGrant) =>
  canGrant({ isSuper: actor.role.isSuper, permissions: actor.permissions }, role);

/**
 * Runs a team change. Inputs come straight from the client, so each action re-checks the
 * permission and validates every argument before touching the database.
 */
const teamChange = async <TData extends object>(
  permission: AdminPermission,
  run: (db: Db, actor: AdminUser) => Promise<TeamResult<TData>>,
): Promise<TeamResult<TData>> => {
  const actor = await requireAdmin(permission);
  const db = getDb();
  if (!db) return { ok: false, error: "noDatabase" };

  const result = await run(db, actor);
  if (result.ok) refresh();
  return result;
};

/**
 * A change to someone else's account: they must exist, not be the actor, and hold no access the
 * actor lacks.
 */
const memberChange = <TData extends object>(
  permission: AdminPermission,
  id: unknown,
  run: (
    db: Db,
    actor: AdminUser,
    member: NonNullable<Awaited<ReturnType<typeof findTeamMember>>>,
  ) => Promise<TeamResult<TData>>,
): Promise<TeamResult<TData>> => {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return Promise.resolve({ ok: false, error: "invalid" });
  return teamChange(permission, async (db, actor) => {
    if (parsed.data === actor.id) return { ok: false, error: "self" };
    const member = await findTeamMember(db, parsed.data);
    if (!member) return { ok: false, error: "notFound" };
    if (!covers(actor, { isSuper: member.roleIsSuper, permissions: member.rolePermissions })) {
      return { ok: false, error: "outranked" };
    }
    return run(db, actor, member);
  });
};

/**
 * Emails a set-up link. If the email can't go (Resend isn't configured or refused it), the link
 * comes back so whoever added them can pass it on.
 */
const invite = async (
  db: Db,
  actor: AdminUser,
  person: { id: number; name: string; email: string; roleName: string },
  resent = false,
) => {
  const link = await createAuthLink(db, person.id, "verify_email");
  const emailed = await sendInviteEmail(person, {
    link,
    roleName: person.roleName,
    invitedBy: actor.name,
  });
  await recordAudit(db, {
    actor,
    action: resent ? "team.invite_resent" : "team.invited",
    target: personLabel(person),
    details: { role: person.roleName, emailed },
  });
  return { ok: true as const, emailed, inviteLink: emailed ? null : link };
};

export const addAdminUser = async (input: unknown): Promise<InviteResult> => {
  const parsed = adminUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return teamChange("identity:create", async (db, actor) => {
    const role = await findRole(db, parsed.data.roleId);
    if (!role) return { ok: false, error: "invalid" };
    if (!covers(actor, role)) return { ok: false, error: "roleNotAllowed" };

    const created = await createAdminUser(db, parsed.data, actor.id);
    if (!created.ok) return created;
    return invite(db, actor, { id: created.id, ...parsed.data, roleName: role.name });
  });
};

/** Sends a fresh set-up link to someone who hasn't finished setting up; the old link stops working. */
export const resendInvite = async (id: unknown): Promise<InviteResult> =>
  memberChange("identity:create", id, async (db, actor, member) => {
    if (!member.isActive) return { ok: false, error: "notFound" };
    if (member.emailVerifiedAt) return { ok: false, error: "alreadySetUp" };
    return invite(db, actor, member, true);
  });

export const changeAdminUserRole = async (id: unknown, roleId: unknown): Promise<TeamResult> => {
  const parsedRole = idSchema.safeParse(roleId);
  if (!parsedRole.success) return { ok: false, error: "invalid" };
  return memberChange("identity:edit", id, async (db, actor, member) => {
    if (member.roleId === parsedRole.data) return { ok: true };
    const role = await findRole(db, parsedRole.data);
    if (!role) return { ok: false, error: "invalid" };
    if (!covers(actor, role)) return { ok: false, error: "roleNotAllowed" };

    const result = await updateAdminUserRole(db, member.id, role.id);
    if (result.ok) {
      await recordAudit(db, {
        actor,
        action: "team.role_changed",
        target: personLabel(member),
        details: { from: member.roleName, to: role.name },
      });
    }
    return result;
  });
};

export const setAdminUserAccess = async (id: unknown, isActive: unknown): Promise<TeamResult> => {
  const parsedActive = z.boolean().safeParse(isActive);
  if (!parsedActive.success) return { ok: false, error: "invalid" };
  const active = parsedActive.data;
  return memberChange("identity:deactivate", id, async (db, actor, member) => {
    const result = await setAdminUserActive(db, member.id, active);
    if (result.ok && member.isActive !== active) {
      await recordAudit(db, {
        actor,
        action: active ? "team.access_restored" : "team.access_removed",
        target: personLabel(member),
      });
    }
    return result;
  });
};

/**
 * Locks someone out, e.g. when their password or email may be in someone else's hands. They're
 * signed out everywhere at once and can't sign in until someone with `auth:lock` unlocks them.
 */
export const lockAccount = async (id: unknown, reason: unknown): Promise<TeamResult> => {
  const parsedReason = lockReasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: "invalid" };
  return memberChange("auth:lock", id, async (db, actor, member) => {
    const result = await lockAdminUser(db, member.id, {
      lockedById: actor.id,
      reason: parsedReason.data,
    });
    if (!result.ok) return result;

    await recordAudit(db, {
      actor,
      action: "team.locked",
      target: personLabel(member),
      details: { reason: parsedReason.data || null },
    });
    const person = await findAdminById(db, member.id);
    if (person) {
      await sendSecurityNotice(person, "accountLocked", {
        values: { ownerName: actor.name },
        always: true,
      });
    }
    return result;
  });
};

export const unlockAccount = async (id: unknown): Promise<TeamResult> =>
  memberChange("auth:lock", id, async (db, actor, member) => {
    const result = await unlockAdminUser(db, member.id);
    if (!result.ok) return result;

    await recordAudit(db, { actor, action: "team.unlocked", target: personLabel(member) });
    const person = await findAdminById(db, member.id);
    if (person) {
      await sendSecurityNotice(person, "accountUnlocked", {
        values: { ownerName: actor.name },
        always: true,
      });
    }
    return result;
  });

/** Signs someone out on every device; they can sign straight back in. */
export const signOutEverywhere = async (id: unknown): Promise<TeamResult> =>
  memberChange("auth:sessions", id, async (db, actor, member) => {
    await endAllSessions(db, member.id);
    await recordAudit(db, { actor, action: "team.signed_out", target: personLabel(member) });
    return { ok: true };
  });

/**
 * Turns off someone's two-step verification, for when they've lost their phone or email access.
 * They're signed out everywhere; if their role needs two-step verification they set it up again
 * at their next sign-in. People change their own from Settings instead.
 */
export const resetTwoFactor = async (id: unknown): Promise<TeamResult> =>
  memberChange("auth:reset-2fa", id, async (db, actor, member) => {
    const result = await resetAdminTwoFactor(db, member.id);
    if (!result.ok) return result;

    await recordAudit(db, { actor, action: "team.two_factor_reset", target: personLabel(member) });
    const person = await findAdminById(db, member.id);
    if (person) {
      await sendSecurityNotice(person, "twoFactorReset", {
        values: { ownerName: actor.name },
        always: true,
      });
    }
    return result;
  });

/**
 * Hands SuperAdmin to someone else; there's only ever one. Only the SuperAdmin can do it, with
 * their password, and they take `newRoleId` (any role but SuperAdmin) in the same step. The new
 * SuperAdmin must be active and not locked. Both get an email whatever their settings.
 */
export const handOverSuperAdmin = async (
  id: unknown,
  newRoleId: unknown,
  password: unknown,
): Promise<TeamResult> => {
  const parsedRole = idSchema.safeParse(newRoleId);
  if (!parsedRole.success) return { ok: false, error: "invalid" };
  return memberChange("identity:edit", id, async (db, actor, member) => {
    if (!actor.role.isSuper) return { ok: false, error: "notSuperAdmin" };
    const self = await findAdminById(db, actor.id);
    if (!self) return { ok: false, error: "notFound" };
    const checked = await checkCurrentPassword(db, self, password);
    if (checked !== "ok") return { ok: false, error: checked };
    const role = await findRole(db, parsedRole.data);
    if (!role || role.isSuper) return { ok: false, error: "invalid" };

    const result = await transferSuperAdmin(db, {
      fromId: actor.id,
      toId: member.id,
      fromRoleId: role.id,
    });
    if (!result.ok) return result;

    await recordAudit(db, {
      actor,
      action: "team.super_admin_transferred",
      target: personLabel(member),
      details: { formerSuperAdminRole: role.name },
    });
    const person = await findAdminById(db, member.id);
    if (person) {
      await sendSecurityNotice(person, "superAdminReceived", {
        values: { ownerName: actor.name },
        always: true,
      });
    }
    await sendSecurityNotice(self, "superAdminHandedOver", {
      values: { memberName: member.name, role: role.name },
      always: true,
    });
    return result;
  });
};
