CREATE TYPE "public"."campaign_approval" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "approval" "campaign_approval" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "requested_by_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reviewed_by_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_admin_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_requested_by_id_admin_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_reviewed_by_id_admin_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_approval_index" ON "campaigns" USING btree ("approval");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_approved_by_someone_else" CHECK ("campaigns"."approval" <> 'approved' or ("campaigns"."created_by_id" is null and "campaigns"."requested_by_id" is null) or ("campaigns"."reviewed_by_id" is not null and "campaigns"."reviewed_by_id" is distinct from "campaigns"."created_by_id" and "campaigns"."reviewed_by_id" is distinct from "campaigns"."requested_by_id"));--> statement-breakpoint
-- Campaigns from before approvals stay on the site.
UPDATE "campaigns" SET "approval" = 'approved';--> statement-breakpoint
-- Finance approves campaigns (never their own). Matches BUILT_IN_ROLES in src/lib/admin/permissions.ts.
UPDATE "admin_roles" SET "permissions" = ARRAY['dashboard:read', 'donations:read', 'donations:export', 'donors:read', 'donors:export', 'campaigns:read', 'campaigns:create', 'campaigns:edit', 'campaigns:approve', 'campaigns:delete', 'funds:read', 'funds:edit']::text[] WHERE "slug" = 'finance';
