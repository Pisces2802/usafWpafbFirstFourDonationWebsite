import type { AppPathname } from "@/i18n/routing";

export type NavItem = {
  href: AppPathname;
  labelKey:
    | "about"
    | "programs"
    | "stories"
    | "getInvolved"
    | "contact"
    | "transparency"
    | "privacy"
    | "donorPrivacy"
    | "terms";
};

export const mainNav: NavItem[] = [
  { href: "/about", labelKey: "about" },
  { href: "/programs", labelKey: "programs" },
  { href: "/stories", labelKey: "stories" },
  { href: "/get-involved", labelKey: "getInvolved" },
];

export const footerExploreNav: NavItem[] = [...mainNav, { href: "/contact", labelKey: "contact" }];

export const footerLegalNav: NavItem[] = [
  { href: "/transparency", labelKey: "transparency" },
  { href: "/privacy", labelKey: "privacy" },
  { href: "/donor-privacy", labelKey: "donorPrivacy" },
  { href: "/terms", labelKey: "terms" },
];
