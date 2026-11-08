CREATE TYPE "public"."admin_session_stage" AS ENUM('two_factor', 'active');--> statement-breakpoint
CREATE TYPE "public"."admin_token_purpose" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TABLE "admin_recovery_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"admin_user_id" integer NOT NULL,
	"stage" "admin_session_stage" NOT NULL,
	"pending_totp_secret" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"ip" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"purpose" "admin_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "failed_sign_in_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_tokens" ADD CONSTRAINT "admin_tokens_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_recovery_codes_admin_user_id_index" ON "admin_recovery_codes" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_user_id_index" ON "admin_sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_tokens_admin_user_id_index" ON "admin_tokens" USING btree ("admin_user_id");