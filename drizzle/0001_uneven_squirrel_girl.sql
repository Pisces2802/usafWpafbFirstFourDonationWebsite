CREATE TYPE "public"."contact_topic" AS ENUM('general', 'airmen', 'giving', 'partnering', 'other');--> statement-breakpoint
CREATE TYPE "public"."volunteer_affiliation" AS ENUM('airman', 'military', 'family', 'community');--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" "contact_topic" NOT NULL,
	"message" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "affiliation" "volunteer_affiliation";