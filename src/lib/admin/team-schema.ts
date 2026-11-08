import { z } from "zod";

import { ADMIN_ROLES } from "@/lib/admin/permissions";

/** Shared by the add-person form and its server action. */
export const adminUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: z.enum(ADMIN_ROLES),
});

export type AdminUserInput = z.input<typeof adminUserSchema>;
export type AdminUserValues = z.output<typeof adminUserSchema>;

export const ADMIN_USER_FIELDS = [
  "name",
  "email",
  "role",
] as const satisfies readonly (keyof AdminUserInput)[];

/** Reasons a team change can be refused, keyed into `Admin.team.errors`. */
export const TEAM_ERRORS = [
  "invalid",
  "emailTaken",
  "notFound",
  "lastOwner",
  "noDatabase",
  "alreadySetUp",
] as const;
export type TeamError = (typeof TEAM_ERRORS)[number];

export type TeamResult<TData = object> = ({ ok: true } & TData) | { ok: false; error: TeamError };

/** After adding or re-inviting someone: whether the email went, and the link if it didn't. */
export type InviteResult = TeamResult<{ emailed: boolean; inviteLink: string | null }>;
