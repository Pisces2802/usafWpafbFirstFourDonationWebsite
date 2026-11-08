import {
  Flag,
  HandCoins,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

import type { AdminPermission } from "@/lib/admin/permissions";

export type AdminNavKey =
  | "dashboard"
  | "donations"
  | "donors"
  | "volunteers"
  | "messages"
  | "campaigns"
  | "funds"
  | "team"
  | "settings";

export type AdminNavItem = {
  key: AdminNavKey;
  href: `/admin${string}`;
  icon: LucideIcon;
  /** Omitted for sections every signed-in person can open. */
  permission?: AdminPermission;
};

export const adminNav: readonly AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard, permission: "dashboard:view" },
  { key: "donations", href: "/admin/donations", icon: HandCoins, permission: "donations:view" },
  { key: "donors", href: "/admin/donors", icon: Users, permission: "donors:view" },
  {
    key: "volunteers",
    href: "/admin/volunteers",
    icon: HeartHandshake,
    permission: "volunteers:view",
  },
  { key: "messages", href: "/admin/messages", icon: Inbox, permission: "messages:view" },
  { key: "campaigns", href: "/admin/campaigns", icon: Flag, permission: "campaigns:manage" },
  { key: "funds", href: "/admin/funds", icon: PiggyBank, permission: "funds:manage" },
  { key: "team", href: "/admin/team", icon: UserCog, permission: "team:manage" },
  { key: "settings", href: "/admin/settings", icon: Settings },
];
