import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/env";

const createDb = (url: string) =>
  drizzle({
    client: postgres(url, { max: 5, prepare: false }),
    schema,
    casing: "snake_case",
  });

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let db: Db | null = null;

/**
 * Drizzle client, or null when `DATABASE_URL` isn't set. Prepared statements are off so it works
 * behind the transaction poolers Neon and Supabase put in front of Postgres.
 */
export const getDb = () => {
  if (!env.DATABASE_URL) return null;
  db ??= createDb(env.DATABASE_URL);
  return db;
};
