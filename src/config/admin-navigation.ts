import {
  Flag,
  HandCoins,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  MailCheck,
  BookOpenText,
  type LucideIcon,
  PiggyBank,
  ScrollText,
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
  | "subscribers"
  | "campaigns"
  | "funds"
  | "stories"
  | "team"
  | "audit"
  | "settings";

export type AdminNavItem = {
  key: AdminNavKey;
  href: `/admin${string}`;
  icon: LucideIcon;
  /** Omitted for sections every signed-in person can open. */
  permission?: AdminPermission;
};

export const adminNav: readonly AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard, permission: "dashboard:read" },
  { key: "donations", href: "/admin/donations", icon: HandCoins, permission: "donations:read" },
  { key: "donors", href: "/admin/donors", icon: Users, permission: "donors:read" },
  {
    key: "volunteers",
    href: "/admin/volunteers",
    icon: HeartHandshake,
    permission: "volunteers:read",
  },
  { key: "messages", href: "/admin/messages", icon: Inbox, permission: "messages:read" },
  {
    key: "subscribers",
    href: "/admin/subscribers",
    icon: MailCheck,
    permission: "subscribers:read",
  },
  { key: "campaigns", href: "/admin/campaigns", icon: Flag, permission: "campaigns:read" },
  { key: "funds", href: "/admin/funds", icon: PiggyBank, permission: "funds:read" },
  { key: "stories", href: "/admin/stories", icon: BookOpenText, permission: "stories:read" },
  { key: "team", href: "/admin/team", icon: UserCog, permission: "identity:read" },
  { key: "audit", href: "/admin/audit-log", icon: ScrollText, permission: "audit:read" },
  { key: "settings", href: "/admin/settings", icon: Settings },
];
