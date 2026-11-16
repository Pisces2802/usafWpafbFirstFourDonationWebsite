/**
 * Every permission the back office checks, as `area:action`. The list lives in code because the
 * code is what enforces it; roles (in the database) are named sets of these, and the group can add
 * roles of their own. Order here is the order the Roles tab shows them.
 */
export const PERMISSION_GROUPS = {
  dashboard: ["dashboard:read"],
  donations: ["donations:read", "donations:export"],
  donors: ["donors:read", "donors:export"],
  volunteers: ["volunteers:read", "volunteers:export"],
  messages: ["messages:read", "messages:export"],
  subscribers: ["subscribers:read", "subscribers:export"],
  campaigns: [
    "campaigns:read",
    "campaigns:create",
    "campaigns:edit",
    "campaigns:approve",
    "campaigns:delete",
  ],
  funds: ["funds:read", "funds:edit"],
  stories: ["stories:read", "stories:create", "stories:edit", "stories:publish", "stories:delete"],
  settings: ["settings:edit"],
  audit: ["audit:read"],
  identity: [
    "identity:read",
    "identity:create",
    "identity:edit",
    "identity:deactivate",
    "identity:roles",
  ],
  auth: ["auth:lock", "auth:reset-2fa", "auth:sessions"],
} as const;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;
export const PERMISSION_GROUP_KEYS = Object.keys(PERMISSION_GROUPS) as PermissionGroup[];

export const ADMIN_PERMISSIONS = Object.values(PERMISSION_GROUPS).flat();
export type AdminPermission = (typeof PERMISSION_GROUPS)[PermissionGroup][number];

/*
 * Segregation of duties. Roles the group adds are checked against two kinds of rule, so no single
 * custom role can be used to take data out or misdirect money. The built-in roles are fixed and
 * reviewed, and are where these powers live.
 */

/**
 * Why a permission is kept to built-in roles:
 * - `platform`: site-wide settings (team inbox, pausing online giving, sign-in length)
 * - `export`: downloading whole lists of people or gifts is the quickest way to leak them
 * - `roles`: whoever writes roles decides what every role can do
 * - `takeover`: resetting someone's second step is half of taking over their account
 */
export type BuiltInOnlyReason = "platform" | "export" | "roles" | "takeover";

export const builtInOnlyReason = (permission: AdminPermission): BuiltInOnlyReason | null => {
  if (permission === "settings:edit") return "platform";
  if (permission.endsWith(":export")) return "export";
  if (permission === "identity:roles") return "roles";
  if (permission === "auth:reset-2fa") return "takeover";
  return null;
};

export const isBuiltInOnly = (permission: AdminPermission) =>
  builtInOnlyReason(permission) !== null;

/** The permissions a custom role may hold. */
export const ASSIGNABLE_PERMISSIONS = ADMIN_PERMISSIONS.filter(
  (permission) => !isBuiltInOnly(permission),
);

/** Giving people access to the back office, or controlling their sign-in. */
const ACCESS_MANAGEMENT: readonly AdminPermission[] = [
  "identity:create",
  "identity:edit",
  "identity:deactivate",
  "auth:lock",
  "auth:sessions",
];

/**
 * Pairs of duties a custom role can't hold together, as [id, one side, other side]:
 * - `accessAndData`: someone who can let people in shouldn't also be able to read donors', gifts'
 *   or volunteers' details, or they could add an account for someone outside and use it
 * - `accessAndFundraising`: someone who can let people in shouldn't also set up the campaigns
 *   and funds donors give to
 */
export const DUTY_CONFLICTS = [
  [
    "accessAndData",
    ACCESS_MANAGEMENT,
    ["donations:read", "donors:read", "volunteers:read", "messages:read", "subscribers:read"],
  ],
  [
    "accessAndFundraising",
    ACCESS_MANAGEMENT,
    ["campaigns:create", "campaigns:edit", "campaigns:approve", "campaigns:delete", "funds:edit"],
  ],
] as const satisfies readonly (readonly [
  string,
  readonly AdminPermission[],
  readonly AdminPermission[],
])[];

export type DutyConflict = (typeof DUTY_CONFLICTS)[number][0];

/** The rules a set of permissions breaks, if any. */
export const dutyConflicts = (permissions: Iterable<AdminPermission>): DutyConflict[] => {
  const held = new Set(permissions);
  return DUTY_CONFLICTS.filter(
    ([, one, other]) => one.some((p) => held.has(p)) && other.some((p) => held.has(p)),
  ).map(([id]) => id);
};

/** The rule that adding `permission` to `selected` would break, if any. */
export const conflictWith = (
  selected: Iterable<AdminPermission>,
  permission: AdminPermission,
): DutyConflict | null => {
  const held = new Set(selected);
  if (held.has(permission)) return null;
  const before = new Set(dutyConflicts(held));
  return dutyConflicts([...held, permission]).find((id) => !before.has(id)) ?? null;
};

export const isAdminPermission = (value: unknown): value is AdminPermission =>
  ADMIN_PERMISSIONS.includes(value as AdminPermission);

/**
 * Permissions over people and their accounts. Anyone holding one must use two-step verification
 * (an authenticator app or emailed codes) and can't turn it off.
 */
export const isSecurityPermission = (permission: AdminPermission) =>
  permission.startsWith("identity:") || permission.startsWith("auth:");

export const requiresTwoFactor = (permissions: Iterable<AdminPermission>) =>
  [...permissions].some(isSecurityPermission);

/**
 * Adds what a permission needs to be usable: anything in an area needs that area's `read` (you
 * can't export gifts you can't see), and the account-security actions need the Team page.
 */
export const withImpliedPermissions = (permissions: Iterable<AdminPermission>) => {
  const result = new Set<AdminPermission>();
  for (const permission of permissions) {
    result.add(permission);
    const [area] = permission.split(":");
    const read = `${area}:read`;
    if (isAdminPermission(read)) result.add(read);
    if (area === "auth") result.add("identity:read");
  }
  return ADMIN_PERMISSIONS.filter((permission) => result.has(permission));
};

/** Whether every permission in `wanted` is in `held`; used so nobody grants more than they have. */
export const holdsAll = (held: ReadonlySet<AdminPermission>, wanted: Iterable<AdminPermission>) =>
  [...wanted].every((permission) => held.has(permission));

/**
 * A role as the access checks see it. SuperAdmin holds every permission, including new ones.
 * `isBuiltIn: false` marks a role the group added, which never holds platform permissions; when
 * it's left out, the stored permissions are taken as they are.
 */
export type RoleGrant = { isSuper: boolean; isBuiltIn?: boolean; permissions: readonly string[] };

/** The permissions a role grants, ignoring any stored name the code no longer knows. */
export const grantedPermissions = (role: RoleGrant): ReadonlySet<AdminPermission> => {
  if (role.isSuper) return new Set(ADMIN_PERMISSIONS);
  const known = role.permissions.filter(isAdminPermission);
  return new Set(
    role.isBuiltIn === false ? known.filter((permission) => !isBuiltInOnly(permission)) : known,
  );
};

/**
 * Whether `actor` may give out `role`, or change the account of someone who holds it. SuperAdmins
 * may do anything; everyone else only roles whose every permission they hold themselves, and never
 * SuperAdmin. This is what stops someone who can edit people from making themselves, or a friend,
 * more powerful. Used by the server actions and, to hide what would be refused, by the Team page.
 */
export const canGrant = (
  actor: { isSuper: boolean; permissions: Iterable<AdminPermission> },
  role: RoleGrant,
) =>
  actor.isSuper ||
  (!role.isSuper && holdsAll(new Set(actor.permissions), grantedPermissions(role)));

/** Whether someone holding `permissions` may do `permission`. */
export const can = (
  subject: { permissions: ReadonlySet<AdminPermission> },
  permission: AdminPermission,
) => subject.permissions.has(permission);

/**
 * The roles every install starts with. Migrations 0009 and 0011 create them, and existing people
 * moved across (owner to SuperAdmin, treasurer to Finance). None of them can be edited or deleted;
 * the group adds its own roles for anything else.
 */
export const BUILT_IN_ROLES = [
  {
    slug: "super-admin",
    name: "SuperAdmin",
    description: "Everything, including people, roles and account security.",
    isSuper: true,
    permissions: [],
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Gifts and donors with their exports, plus campaigns and funds.",
    isSuper: false,
    permissions: [
      "dashboard:read",
      "donations:read",
      "donations:export",
      "donors:read",
      "donors:export",
      "campaigns:read",
      "campaigns:create",
      "campaigns:edit",
      "campaigns:approve",
      "campaigns:delete",
      "funds:read",
      "funds:edit",
    ],
  },
  {
    slug: "coordinator",
    name: "Coordinator",
    description: "Volunteers, messages and subscribers with their exports, plus stories.",
    isSuper: false,
    permissions: [
      "dashboard:read",
      "volunteers:read",
      "volunteers:export",
      "messages:read",
      "messages:export",
      "subscribers:read",
      "subscribers:export",
      "stories:read",
      "stories:create",
      "stories:edit",
      "stories:publish",
      "stories:delete",
    ],
  },
  {
    slug: "auditor",
    name: "Auditor",
    description: "Read-only access to everything, including the team and the audit log.",
    isSuper: false,
    permissions: [
      "dashboard:read",
      "donations:read",
      "donors:read",
      "volunteers:read",
      "messages:read",
      "subscribers:read",
      "campaigns:read",
      "funds:read",
      "stories:read",
      "audit:read",
      "identity:read",
    ],
  },
  {
    slug: "viewer",
    name: "Viewer",
    description: "Dashboard totals only. No names or contact details.",
    isSuper: false,
    permissions: ["dashboard:read"],
  },
  {
    slug: "identity-manager",
    name: "IdentityManager",
    description: "People, roles, account security and site settings. No donor or gift details.",
    isSuper: false,
    permissions: [
      "dashboard:read",
      "settings:edit",
      "audit:read",
      "identity:read",
      "identity:create",
      "identity:edit",
      "identity:deactivate",
      "identity:roles",
      "auth:lock",
      "auth:reset-2fa",
      "auth:sessions",
    ],
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  description: string;
  isSuper: boolean;
  permissions: readonly AdminPermission[];
}[];

export const SUPER_ADMIN_SLUG = "super-admin";
/** Who `pnpm admin:create` and new invites default to when no role is given. */
export const DEFAULT_ROLE_SLUG = "viewer";
