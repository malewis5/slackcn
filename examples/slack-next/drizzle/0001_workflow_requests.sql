CREATE TABLE "pending_requests" (
	"run_id" text PRIMARY KEY NOT NULL,
	"hook_token" text NOT NULL,
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"ts" text NOT NULL,
	"prompt_ts" text
);
--> statement-breakpoint
DROP TABLE "sign_in_prompts" CASCADE;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "uninstalling" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_requests" ADD CONSTRAINT "pending_requests_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_requests_user_idx" ON "pending_requests" USING btree ("installation_id","user_id");