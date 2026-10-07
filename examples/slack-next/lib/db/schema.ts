import type { Installation } from "@slack/bolt";
import { boolean, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const installations = pgTable("installations", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  enterpriseId: text("enterprise_id"),
  isEnterpriseInstall: boolean("is_enterprise_install").notNull().default(false),
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

export const signInPrompts = pgTable(
  "sign_in_prompts",
  {
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    channel: text("channel").notNull(),
    ts: text("ts").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.installationId, table.userId, table.channel, table.ts],
    }),
  ],
);
