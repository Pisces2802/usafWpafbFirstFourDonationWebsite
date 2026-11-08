import "server-only";

import { desc } from "drizzle-orm";
import { headers } from "next/headers";

import type { Db } from "@/db";
import { adminAuditEvents } from "@/db/schema";
import type { AuditAction } from "@/lib/admin/audit-actions";
import { getClientIp } from "@/lib/rate-limit";

type AuditActor = { id: number; name: string; email: string };
export type AuditDetails = Record<string, string | number | boolean | null>;

type AuditEntry = {
  /** Who did it; null for someone who isn't signed in, like a failed sign-in for an unknown email. */
  actor: AuditActor | null;
  action: AuditAction;
  /** What it was done to, as a person reads it: a name and email, a dataset. */
  target?: string | null;
  details?: AuditDetails;
};

/** "Sam Lee <sam@example.com>", how people appear as targets in the log. */
export const personLabel = (person: { name: string; email: string }) =>
  `${person.name} <${person.email}>`;

const requestIp = async () => {
  try {
    return getClientIp(await headers());
  } catch {
    return null;
  }
};

/**
 * Adds an entry to the audit log. A failure is logged, not thrown: by the time this runs the
 * change has happened, and the person shouldn't see an error for it.
 */
export const recordAudit = async (db: Db, { actor, action, target, details }: AuditEntry) => {
  try {
    await db.insert(adminAuditEvents).values({
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      action,
      targetLabel: target ?? null,
      details: details && Object.keys(details).length > 0 ? details : null,
      ip: await requestIp(),
    });
  } catch (error) {
    console.error("Writing to the audit log failed", error);
  }
};

/** The most recent log entries, newest first. */
export const listAuditEvents = (db: Db, limit = 2000) =>
  db
    .select({
      id: adminAuditEvents.id,
      createdAt: adminAuditEvents.createdAt,
      actorName: adminAuditEvents.actorName,
      actorEmail: adminAuditEvents.actorEmail,
      action: adminAuditEvents.action,
      targetLabel: adminAuditEvents.targetLabel,
      details: adminAuditEvents.details,
      ip: adminAuditEvents.ip,
    })
    .from(adminAuditEvents)
    .orderBy(desc(adminAuditEvents.createdAt), desc(adminAuditEvents.id))
    .limit(limit);

export type AuditEventRow = Awaited<ReturnType<typeof listAuditEvents>>[number];
