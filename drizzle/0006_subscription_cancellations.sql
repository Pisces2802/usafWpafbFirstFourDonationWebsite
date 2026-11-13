CREATE TABLE "subscription_cancellations" (
	"stripe_subscription_id" text PRIMARY KEY NOT NULL,
	"cancelled_at" timestamp with time zone NOT NULL
);
