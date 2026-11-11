import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { FUND_IDS, type FundId, isFundId } from "@/config/donation";
import { getDb } from "@/db";
import { funds } from "@/db/schema";

export const FUND_SETTINGS_TAG = "fund-settings";

type FundRow = { slug: string; isActive: boolean; sortOrder: number };

/**
 * Orders the funds in code by their saved position and drops the ones turned off. Funds with no
 * row yet are on and keep their place in `FUND_IDS`. If every fund is off, all of them are shown,
 * since the donate form can't work without one.
 */
export const resolveActiveFunds = (rows: FundRow[]): FundId[] => {
  const saved = new Map(rows.filter((row) => isFundId(row.slug)).map((row) => [row.slug, row]));
  const ordered = [...FUND_IDS].sort(
    (a, b) =>
      (saved.get(a)?.sortOrder ?? FUND_IDS.indexOf(a)) -
        (saved.get(b)?.sortOrder ?? FUND_IDS.indexOf(b)) ||
      FUND_IDS.indexOf(a) - FUND_IDS.indexOf(b),
  );
  const active = ordered.filter((id) => saved.get(id)?.isActive ?? true);
  return active.length ? active : ordered;
};

/**
 * The funds donors can pick, in the order set on the Funds page. Cached, and refreshed as soon as
 * someone changes a fund. Falls back to every fund when there's no database or it can't be read.
 */
export const getActiveFunds = async (): Promise<FundId[]> => {
  "use cache";
  // Changes on the Funds page expire this straight away, so the timer is only a backstop.
  cacheLife({ stale: 300, revalidate: 3600, expire: 86_400 });
  cacheTag(FUND_SETTINGS_TAG);

  const db = getDb();
  if (!db) return [...FUND_IDS];
  try {
    const rows = await db
      .select({ slug: funds.slug, isActive: funds.isActive, sortOrder: funds.sortOrder })
      .from(funds);
    return resolveActiveFunds(rows);
  } catch (error) {
    console.error("Reading fund settings failed", error);
    return [...FUND_IDS];
  }
};
