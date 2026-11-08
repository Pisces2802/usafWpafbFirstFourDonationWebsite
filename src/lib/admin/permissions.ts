export const ADMIN_PERMISSIONS = [
  "dashboard:view",
  "donations:view",
  "donations:export",
  "donors:view",
  "donors:export",
  "volunteers:view",
  "volunteers:export",
  "messages:view",
  "messages:export",
  "campaigns:manage",
  "funds:manage",
  "team:manage",
  "settings:manage",
  "audit:view",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Ordered from most to least access; the Team page lists them in this order. */
export const ADMIN_ROLES = ["owner", "treasurer", "coordinator", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * What each role can do. Roles live in code rather than the database so a change to who can see
 * donor data goes through review. Owners are the only role that can add people or change roles.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  treasurer: [
    "dashboard:view",
    "donations:view",
    "donations:export",
    "donors:view",
    "donors:export",
    "campaigns:manage",
    "funds:manage",
  ],
  coordinator: [
    "dashboard:view",
    "volunteers:view",
    "volunteers:export",
    "messages:view",
    "messages:export",
  ],
  viewer: ["dashboard:view"],
};

export const isAdminRole = (value: unknown): value is AdminRole =>
  ADMIN_ROLES.includes(value as AdminRole);

/** Whether `role` grants `permission`. */
export const can = (role: AdminRole, permission: AdminPermission) =>
  ROLE_PERMISSIONS[role].includes(permission);
