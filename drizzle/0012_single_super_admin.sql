-- Segregation of duties and a single SuperAdmin.
-- See builtInOnlyReason and DUTY_CONFLICTS in src/lib/admin/permissions.ts.

-- Roles the group added can't hold permissions kept to built-in roles: site settings, exports,
-- changing roles and resetting someone's two-step verification.
UPDATE "admin_roles" SET "permissions" = ARRAY(
  SELECT p FROM unnest("permissions") AS p
  WHERE p <> 'settings:edit' AND p NOT LIKE '%:export' AND p <> 'identity:roles' AND p <> 'auth:reset-2fa'
)
WHERE NOT "is_built_in";--> statement-breakpoint

-- A role the group added can't both manage access and see people's details or change fundraising.
-- Where one does, it keeps its other work and loses managing access, which IdentityManager has.
UPDATE "admin_roles" SET "permissions" = ARRAY(
  SELECT p FROM unnest("permissions") AS p
  WHERE p NOT IN ('identity:create', 'identity:edit', 'identity:deactivate', 'auth:lock', 'auth:sessions')
)
WHERE NOT "is_built_in"
  AND "permissions" && ARRAY['identity:create', 'identity:edit', 'identity:deactivate', 'auth:lock', 'auth:sessions']::text[]
  AND "permissions" && ARRAY['donations:read', 'donors:read', 'volunteers:read', 'messages:read', 'subscribers:read', 'campaigns:create', 'campaigns:edit', 'campaigns:delete', 'funds:edit']::text[];--> statement-breakpoint

-- One SuperAdmin. If there are several, the earliest one who can sign in keeps it (or the earliest
-- at all) and the others become IdentityManagers.
UPDATE "admin_users" SET "role_id" = (SELECT "id" FROM "admin_roles" WHERE "slug" = 'identity-manager')
WHERE "role_id" IN (SELECT "id" FROM "admin_roles" WHERE "is_super")
  AND "id" <> (
    SELECT "id" FROM "admin_users"
    WHERE "role_id" IN (SELECT "id" FROM "admin_roles" WHERE "is_super")
    ORDER BY ("is_active" AND "suspended_at" IS NULL) DESC, "id"
    LIMIT 1
  );--> statement-breakpoint

-- Kept by the database too. Taking a lock on the SuperAdmin role first makes two people being
-- made SuperAdmin at once wait for each other, so the second one sees the first and is refused.
CREATE FUNCTION "admin_users_single_super_admin"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "admin_roles" WHERE "id" = NEW."role_id" AND "is_super") THEN
    PERFORM 1 FROM "admin_roles" WHERE "is_super" FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM "admin_users"
      WHERE "id" <> NEW."id" AND "role_id" IN (SELECT "id" FROM "admin_roles" WHERE "is_super")
    ) THEN
      RAISE EXCEPTION 'There can only be one SuperAdmin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "admin_users_single_super_admin"
BEFORE INSERT OR UPDATE OF "role_id" ON "admin_users"
FOR EACH ROW EXECUTE FUNCTION "admin_users_single_super_admin"();
