import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { type Db, getDb } from "@/db";
import { adminRoles, adminUsers } from "@/db/schema";
import { env } from "@/env";
import { grantedPermissions } from "@/lib/admin/permissions";
import { readPlatformSettings } from "@/lib/admin/platform-settings";
import { type OrgNotice, sendOrgNotice } from "@/lib/emails";

export type NoticeTopic = "volunteers" | "messages";

const OPT_IN = { volunteers: adminUsers.notifyVolunteers, messages: adminUsers.notifyMessages };

/** Active team members who asked for this kind of email and whose role can see it. */
const subscribers = async (db: Db, topic: NoticeTopic) => {
  const rows = await db
    .select({
      email: adminUsers.email,
      isSuper: adminRoles.isSuper,
      permissions: adminRoles.permissions,
    })
    .from(adminUsers)
    .innerJoin(adminRoles, eq(adminUsers.roleId, adminRoles.id))
    .where(
      and(eq(adminUsers.isActive, true), isNull(adminUsers.suspendedAt), eq(OPT_IN[topic], true)),
    );
  return rows.filter((row) => grantedPermissions(row).has(`${topic}:read`)).map((row) => row.email);
};

/**
 * Emails a volunteer sign-up or contact message to the team inbox (set on the Platform tab, or
 * `ORG_NOTIFY_EMAIL`) and to everyone who turned that notification on. A failure to reach the
 * inbox is thrown, as before; a failure to reach one person is only logged.
 */
export const deliverOrgNotice = async (topic: NoticeTopic, notice: OrgNotice) => {
  const db = getDb();
  const settings = await readPlatformSettings(db);
  const inbox = settings.inboxEmail ?? env.ORG_NOTIFY_EMAIL ?? null;
  const people = db ? await subscribers(db, topic).catch(() => []) : [];

  const results = await Promise.allSettled(
    people.filter((email) => email !== inbox).map((email) => sendOrgNotice(email, notice)),
  );
  for (const result of results) {
    if (result.status === "rejected") console.error("Emailing a team member failed", result.reason);
  }

  if (inbox) await sendOrgNotice(inbox, notice);
};
