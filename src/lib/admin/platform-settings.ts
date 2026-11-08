import "server-only";

import { eq } from "drizzle-orm";

import { type Db, getDb } from "@/db";
import { adminUsers, platformSettings } from "@/db/schema";

type PlatformValues = { inboxEmail: string | null; donationsPaused: boolean; sessionHours: number };

const DEFAULTS: PlatformValues = { inboxEmail: null, donationsPaused: false, sessionHours: 12 };

/** The site's settings, with defaults until an owner first saves them. */
export const getPlatformSettings = async (db: Db): Promise<PlatformValues> => {
  const [row] = await db
    .select({
      inboxEmail: platformSettings.inboxEmail,
      donationsPaused: platformSettings.donationsPaused,
      sessionHours: platformSettings.sessionHours,
    })
    .from(platformSettings)
    .where(eq(platformSettings.id, 1))
    .limit(1);
  return row ?? DEFAULTS;
};

/** The settings plus who last changed them, for the Platform tab. */
export const getPlatformSettingsForEditing = async (db: Db) => {
  const [row] = await db
    .select({
      inboxEmail: platformSettings.inboxEmail,
      donationsPaused: platformSettings.donationsPaused,
      sessionHours: platformSettings.sessionHours,
      updatedAt: platformSettings.updatedAt,
      updatedBy: adminUsers.name,
    })
    .from(platformSettings)
    .leftJoin(adminUsers, eq(platformSettings.updatedById, adminUsers.id))
    .where(eq(platformSettings.id, 1))
    .limit(1);
  return row ?? { ...DEFAULTS, updatedAt: null, updatedBy: null };
};

export const savePlatformSettings = (db: Db, values: PlatformValues, updatedById: number) => {
  const set = { ...values, updatedById, updatedAt: new Date() };
  return db
    .insert(platformSettings)
    .values({ id: 1, ...set })
    .onConflictDoUpdate({ target: platformSettings.id, set });
};

/** Settings, or the defaults when the database can't be read, so an outage there changes nothing. */
export const readPlatformSettings = async (db: Db | null = getDb()) => {
  if (!db) return DEFAULTS;
  try {
    return await getPlatformSettings(db);
  } catch (error) {
    console.error("Reading platform settings failed", error);
    return DEFAULTS;
  }
};
