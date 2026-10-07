import type { Installation } from "@slack/bolt";
import { boolean, index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const installations = pgTable("installations", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  enterpriseId: text("enterprise_id"),
  isEnterpriseInstall: boolean("is_enterprise_install").notNull().default(false),
  uninstalling: boolean("uninstalling").notNull().default(false),
  installation: jsonb("installation").$type<Installation>().notNull(),
});

export const signedInUsers = pgTable(
  "signed_in_users",
  {
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.installationId, table.userId] })],
);

// Only the directory of live requests. Execution and signals live in Workflow.
export const pendingRequests = pgTable(
  "pending_requests",
  {
    runId: text("run_id").primaryKey(),
    hookToken: text("hook_token").notNull(),
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    channel: text("channel").notNull(),
    /** Original mention timestamp. */
    ts: text("ts").notNull(),
    promptTs: text("prompt_ts"),
  },
  (table) => [index("pending_requests_user_idx").on(table.installationId, table.userId)],
);
