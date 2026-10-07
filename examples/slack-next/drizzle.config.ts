import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const env = readFileSync(".env.local", "utf8");
  const line = env.split("\n").find((entry) => entry.startsWith("DATABASE_URL="));
  const url = line?.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl(),
  },
});
