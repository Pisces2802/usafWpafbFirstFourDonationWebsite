import { z } from "@/lib/zod";

import { ASSIGNABLE_PERMISSIONS } from "@/lib/admin/permissions";

/** Shared by the add-person form and its server action. */
export const adminUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // The form's select gives a string; the server action may get either.
  roleId: z.coerce.number<number | string>().int().positive(),
});

export type AdminUserInput = z.input<typeof adminUserSchema>;
export type AdminUserValues = z.output<typeof adminUserSchema>;

export const ADMIN_USER_FIELDS = [
  "name",
  "email",
  "roleId",
] as const satisfies readonly (keyof AdminUserInput)[];

/** Why an account is being locked, kept with the lock and in the audit log. Optional. */
export const lockReasonSchema = z.string().trim().max(300);

/** Shared by the role form and its server actions. Permission names come from the code. */
export const roleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200),
  permissions: z.array(z.enum(ASSIGNABLE_PERMISSIONS)).max(ASSIGNABLE_PERMISSIONS.length),
});

export type RoleInput = z.input<typeof roleSchema>;
export type RoleValues = z.output<typeof roleSchema>;

export const ROLE_FIELDS = [
  "name",
  "description",
  "permissions",
] as const satisfies readonly (keyof RoleInput)[];

/** Reasons a team or role change can be refused, keyed into `Admin.team.errors`. */
export const TEAM_ERRORS = [
  "invalid",
  "emailTaken",
  "notFound",
  "lastSuperAdmin",
  "noDatabase",
  "alreadySetUp",
  "noTwoFactor",
  "self",
  "notLocked",
  /** The person has access the actor doesn't, so the actor can't change their account. */
  "outranked",
  /** The role grants something the actor doesn't hold, so they can't give it to anyone. */
  "roleNotAllowed",
  "roleNameTaken",
  "roleBuiltIn",
  "roleSuperAdmin",
  "roleInUse",
  "ownRole",
  /** The role mixes duties that should be split between people (see DUTY_CONFLICTS). */
  "dutyConflict",
  /** There's already a SuperAdmin; hand the role over instead. */
  "superAdminTaken",
  "wrongPassword",
  "rateLimited",
  /** Only the SuperAdmin can hand the role over. */
  "notSuperAdmin",
  /** The person is locked, so can't be given SuperAdmin. */
  "memberLocked",
] as const;
export type TeamError = (typeof TEAM_ERRORS)[number];

export type TeamResult<TData = object> = ({ ok: true } & TData) | { ok: false; error: TeamError };

/** After adding or re-inviting someone: whether the email went, and the link if it didn't. */
export type InviteResult = TeamResult<{ emailed: boolean; inviteLink: string | null }>;
