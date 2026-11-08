"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type Db, getDb } from "@/db";
import { type AdminUser, requireAdmin } from "@/lib/admin/access";
import { createAuthLink, sendInviteEmail } from "@/lib/admin/auth/links";
import { findAdminById } from "@/lib/admin/auth/queries";
import { ADMIN_ROLES } from "@/lib/admin/permissions";
import { createAdminUser, setAdminUserActive, updateAdminUserRole } from "@/lib/admin/team-queries";
import { adminUserSchema, type InviteResult, type TeamResult } from "@/lib/admin/team-schema";

const idSchema = z.number().int().positive();

/**
 * Runs a team change for an owner. Inputs come straight from the client, so each action
 * re-checks the permission and validates every argument before touching the database.
 */
const teamChange = async <TData extends object>(
  run: (db: Db, actor: AdminUser) => Promise<TeamResult<TData>>,
): Promise<TeamResult<TData>> => {
  const actor = await requireAdmin("team:manage");
  const db = getDb();
  if (!db) return { ok: false, error: "noDatabase" };

  const result = await run(db, actor);
  if (result.ok) refresh();
  return result;
};

/**
 * Emails a set-up link. If the email can't go (Resend isn't configured or refused it), the link
 * comes back so the owner can pass it on themselves.
 */
const invite = async (
  db: Db,
  actor: AdminUser,
  person: { id: number; name: string; email: string; role: (typeof ADMIN_ROLES)[number] },
) => {
  const link = await createAuthLink(db, person.id, "verify_email");
  const emailed = await sendInviteEmail(person, {
    link,
    role: person.role,
    invitedBy: actor.name,
  });
  return { ok: true as const, emailed, inviteLink: emailed ? null : link };
};

export const addAdminUser = async (input: unknown): Promise<InviteResult> => {
  const parsed = adminUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return teamChange(async (db, actor) => {
    const created = await createAdminUser(db, parsed.data, actor.id);
    if (!created.ok) return created;
    return invite(db, actor, { id: created.id, ...parsed.data });
  });
};

/** Sends a fresh set-up link to someone who hasn't finished setting up; the old link stops working. */
export const resendInvite = async (id: unknown): Promise<InviteResult> => {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return teamChange(async (db, actor) => {
    const person = await findAdminById(db, parsed.data);
    if (!person || !person.isActive) return { ok: false, error: "notFound" };
    if (person.emailVerifiedAt) return { ok: false, error: "alreadySetUp" };
    return invite(db, actor, person);
  });
};

export const changeAdminUserRole = async (id: unknown, role: unknown): Promise<TeamResult> => {
  const parsed = z.tuple([idSchema, z.enum(ADMIN_ROLES)]).safeParse([id, role]);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return teamChange((db) => updateAdminUserRole(db, ...parsed.data));
};

export const setAdminUserAccess = async (id: unknown, isActive: unknown): Promise<TeamResult> => {
  const parsed = z.tuple([idSchema, z.boolean()]).safeParse([id, isActive]);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return teamChange((db) => setAdminUserActive(db, ...parsed.data));
};
