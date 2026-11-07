import { adminTranslator } from "@/lib/admin/translator";
import type { AdminRole } from "@/lib/admin/permissions";

/** A role's display name, for server code that has no request locale (emails, route handlers). */
export const roleName = (role: AdminRole) => adminTranslator(`roles.${role}.name`);
