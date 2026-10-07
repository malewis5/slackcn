CREATE TABLE "installations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text,
	"enterprise_id" text,
	"is_enterprise_install" boolean DEFAULT false NOT NULL,
	"installation" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_prompts" (
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"ts" text NOT NULL,
	CONSTRAINT "sign_in_prompts_installation_id_user_id_channel_ts_pk" PRIMARY KEY("installation_id","user_id","channel","ts")
);
--> statement-breakpoint
CREATE TABLE "signed_in_users" (
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "signed_in_users_installation_id_user_id_pk" PRIMARY KEY("installation_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "sign_in_prompts" ADD CONSTRAINT "sign_in_prompts_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_in_users" ADD CONSTRAINT "signed_in_users_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;