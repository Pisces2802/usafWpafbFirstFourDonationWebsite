-- Site-wide settings move to two built-in roles only: SuperAdmin and the new IdentityManager.
-- Built-in roles also become fixed, so each is reset to its definition in BUILT_IN_ROLES
-- (src/lib/admin/permissions.ts) in case it was edited while that was allowed.

-- A role the group added under the same name keeps its people but gets out of the way.
UPDATE "admin_roles" SET "name" = "name" || ' (custom)'
WHERE lower("name") = 'identitymanager' AND NOT "is_built_in";--> statement-breakpoint
INSERT INTO "admin_roles" ("slug", "name", "description", "permissions", "is_super", "is_built_in") VALUES
  ('identity-manager', 'IdentityManager', 'People, roles, account security and site settings. No donor or gift details.', ARRAY['dashboard:read', 'settings:edit', 'audit:read', 'identity:read', 'identity:create', 'identity:edit', 'identity:deactivate', 'identity:roles', 'auth:lock', 'auth:reset-2fa', 'auth:sessions']::text[], false, true);--> statement-breakpoint
UPDATE "admin_roles" SET "name" = 'SuperAdmin', "description" = 'Everything, including people, roles and account security.', "permissions" = ARRAY[]::text[], "is_super" = true WHERE "slug" = 'super-admin';--> statement-breakpoint
UPDATE "admin_roles" SET "name" = 'Finance', "description" = 'Gifts and donors with their exports, plus campaigns and funds.', "permissions" = ARRAY['dashboard:read', 'donations:read', 'donations:export', 'donors:read', 'donors:export', 'campaigns:read', 'campaigns:create', 'campaigns:edit', 'campaigns:delete', 'funds:read', 'funds:edit']::text[] WHERE "slug" = 'finance';--> statement-breakpoint
UPDATE "admin_roles" SET "name" = 'Coordinator', "description" = 'Volunteers, messages and subscribers with their exports, plus stories.', "permissions" = ARRAY['dashboard:read', 'volunteers:read', 'volunteers:export', 'messages:read', 'messages:export', 'subscribers:read', 'subscribers:export', 'stories:read', 'stories:create', 'stories:edit', 'stories:publish', 'stories:delete']::text[] WHERE "slug" = 'coordinator';--> statement-breakpoint
UPDATE "admin_roles" SET "name" = 'Auditor', "description" = 'Read-only access to everything, including the team and the audit log.', "permissions" = ARRAY['dashboard:read', 'donations:read', 'donors:read', 'volunteers:read', 'messages:read', 'subscribers:read', 'campaigns:read', 'funds:read', 'stories:read', 'audit:read', 'identity:read']::text[] WHERE "slug" = 'auditor';--> statement-breakpoint
UPDATE "admin_roles" SET "name" = 'Viewer', "description" = 'Dashboard totals only. No names or contact details.', "permissions" = ARRAY['dashboard:read']::text[] WHERE "slug" = 'viewer';--> statement-breakpoint
-- Roles the group added can't hold site settings.
UPDATE "admin_roles" SET "permissions" = array_remove("permissions", 'settings:edit')
WHERE NOT "is_built_in";
