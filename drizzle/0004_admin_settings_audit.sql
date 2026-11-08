CREATE TABLE "admin_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"actor_email" text,
	"action" text NOT NULL,
	"target_label" text,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"inbox_email" text,
	"donations_paused" boolean DEFAULT false NOT NULL,
	"session_hours" integer DEFAULT 12 NOT NULL,
	"updated_by_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_single_row" CHECK ("platform_settings"."id" = 1),
	CONSTRAINT "platform_settings_session_hours" CHECK ("platform_settings"."session_hours" between 1 and 24)
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "page_size" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "notify_volunteers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "notify_messages" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "notify_security" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_id_admin_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_at_index" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_id_index" ON "admin_audit_events" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_page_size" CHECK ("admin_users"."page_size" in (10, 20, 50, 100));