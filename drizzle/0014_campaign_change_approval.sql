ALTER TABLE "campaigns" ADD COLUMN "proposed_change" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "change_requested_by_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "change_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "change_reviewed_by_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "change_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "change_review_note" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_change_requested_by_id_admin_users_id_fk" FOREIGN KEY ("change_requested_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_change_reviewed_by_id_admin_users_id_fk" FOREIGN KEY ("change_reviewed_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Kept by the database too: once a campaign is approved, its link, goal and dates only change by
-- applying the waiting change exactly as asked, with a fresh review by someone other than whoever
-- asked; and an approved campaign can't go back to waiting or turned down.
CREATE FUNCTION "campaigns_changes_approved"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."approval" = 'approved' AND NEW."approval" <> 'approved' THEN
    RAISE EXCEPTION 'An approved campaign stays approved';
  END IF;
  IF OLD."approval" = 'approved' AND (NEW."slug", NEW."goal_cents", NEW."starts_at", NEW."ends_at")
      IS DISTINCT FROM (OLD."slug", OLD."goal_cents", OLD."starts_at", OLD."ends_at") THEN
    IF OLD."proposed_change" IS NULL
      OR NEW."change_reviewed_by_id" IS NULL
      OR NEW."change_reviewed_by_id" IS NOT DISTINCT FROM OLD."change_requested_by_id"
      OR NEW."change_reviewed_at" IS NOT DISTINCT FROM OLD."change_reviewed_at"
      OR NEW."slug" IS DISTINCT FROM OLD."proposed_change"->>'slug'
      OR NEW."goal_cents" IS DISTINCT FROM (OLD."proposed_change"->>'goalCents')::integer
      OR NEW."starts_at" IS DISTINCT FROM (OLD."proposed_change"->>'startsAt')::timestamptz
      OR NEW."ends_at" IS DISTINCT FROM (OLD."proposed_change"->>'endsAt')::timestamptz
    THEN
      RAISE EXCEPTION 'A change to an approved campaign needs approval by someone else';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "campaigns_changes_approved"
BEFORE UPDATE ON "campaigns"
FOR EACH ROW EXECUTE FUNCTION "campaigns_changes_approved"();
