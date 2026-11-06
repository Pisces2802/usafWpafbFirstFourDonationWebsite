CREATE TYPE "public"."donation_status" AS ENUM('succeeded', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('one_time', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."tribute_type" AS ENUM('honour', 'memory');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"goal_cents" integer NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"donor_id" integer NOT NULL,
	"campaign_id" integer,
	"fund_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"fee_covered_cents" integer DEFAULT 0 NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"frequency" "frequency" NOT NULL,
	"status" "donation_status" NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_subscription_id" text,
	"stripe_invoice_id" text,
	"tribute_type" "tribute_type",
	"honoree_name" text,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_stripePaymentIntentId_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "donations_stripeInvoiceId_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"stripe_customer_id" text,
	"locale" text NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donors_email_unique" UNIQUE("email"),
	CONSTRAINT "donors_stripeCustomerId_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "funds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"availability" text,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_donor_id_index" ON "donations" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donations_campaign_id_index" ON "donations" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "donations_stripe_subscription_id_index" ON "donations" USING btree ("stripe_subscription_id");