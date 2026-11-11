"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { adminNav, type AdminNavKey } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

const NAV_CLASS =
  "bg-card border-b lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0";

/**
 * The empty sidebar shown while the role's sections load. It reads no URL, so pages under a
 * dynamic segment, like a story's edit page, can still prerender around it.
 */
export const SidebarFallback = () => <nav aria-hidden="true" className={NAV_CLASS} />;

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Back-office navigation: a scrolling row on small screens, a column beside the content on large.
 * Lists only `keys`, the sections the current role can open.
 */
export const Sidebar = ({ keys }: { keys: readonly AdminNavKey[] }) => {
  const t = useTranslations("Admin");
  const pathname = usePathname();

  return (
    <nav aria-label={t("navLabel")} className={NAV_CLASS}>
      <ul className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:px-3 lg:py-4">
        {adminNav
          .filter((item) => keys.includes(item.key))
          .map(({ key, href, icon: Icon }) => (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2",
                  "aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(`nav.${key}`)}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
};
