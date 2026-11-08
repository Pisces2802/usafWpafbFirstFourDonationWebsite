CREATE TYPE "public"."admin_role" AS ENUM('owner', 'treasurer', 'coordinator', 'viewer');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "admin_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_users_email_lowercase" CHECK ("admin_users"."email" = lower("admin_users"."email"))
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_created_by_id_admin_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;