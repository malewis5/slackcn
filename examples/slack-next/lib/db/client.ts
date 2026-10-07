import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  slackcnPg?: ReturnType<typeof postgres>;
};

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  globalForDb.slackcnPg ??= postgres(url, { max: 10 });
  return drizzle(globalForDb.slackcnPg, { schema });
}
