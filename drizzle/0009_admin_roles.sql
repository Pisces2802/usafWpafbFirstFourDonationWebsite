CREATE TYPE "public"."admin_two_factor_method" AS ENUM('authenticator', 'email');--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_super" boolean DEFAULT false NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "email_code_hash" text;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "email_code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "email_code_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "two_factor_method" "admin_two_factor_method";--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "suspended_by_id" integer;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "suspend_reason" text;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_created_by_id_admin_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_roles_name_lower" ON "admin_roles" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_suspended_by_id_admin_users_id_fk" FOREIGN KEY ("suspended_by_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The built-in roles, matching BUILT_IN_ROLES in src/lib/admin/permissions.ts.
INSERT INTO "admin_roles" ("slug", "name", "description", "permissions", "is_super", "is_built_in") VALUES
  ('super-admin', 'SuperAdmin', 'Everything, including people, roles and account security.', ARRAY[]::text[], true, true),
  ('finance', 'Finance', 'Gifts and donors with their exports, plus campaigns and funds.', ARRAY['dashboard:read', 'donations:read', 'donations:export', 'donors:read', 'donors:export', 'campaigns:read', 'campaigns:create', 'campaigns:edit', 'campaigns:delete', 'funds:read', 'funds:edit']::text[], false, true),
  ('coordinator', 'Coordinator', 'Volunteers, messages and subscribers with their exports, plus stories.', ARRAY['dashboard:read', 'volunteers:read', 'volunteers:export', 'messages:read', 'messages:export', 'subscribers:read', 'subscribers:export', 'stories:read', 'stories:create', 'stories:edit', 'stories:publish', 'stories:delete']::text[], false, true),
  ('auditor', 'Auditor', 'Read-only access to everything, including the team and the audit log.', ARRAY['dashboard:read', 'donations:read', 'donors:read', 'volunteers:read', 'messages:read', 'subscribers:read', 'campaigns:read', 'funds:read', 'stories:read', 'audit:read', 'identity:read']::text[], false, true),
  ('viewer', 'Viewer', 'Dashboard totals only. No names or contact details.', ARRAY['dashboard:read']::text[], false, true);--> statement-breakpoint
-- Everyone keeps the access they had: owner to SuperAdmin, treasurer to Finance.
UPDATE "admin_users" SET "role_id" = (
  SELECT "id" FROM "admin_roles" WHERE "slug" = CASE "admin_users"."role"
    WHEN 'owner' THEN 'super-admin'
    WHEN 'treasurer' THEN 'finance'
    WHEN 'coordinator' THEN 'coordinator'
    ELSE 'viewer'
  END
);--> statement-breakpoint
-- Everyone with an authenticator app keeps using it.
UPDATE "admin_users" SET "two_factor_method" = 'authenticator' WHERE "totp_secret" IS NOT NULL;
