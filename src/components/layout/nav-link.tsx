"use client";

import type { ComponentProps } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import type { AppPathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type NavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: AppPathname;
};

export const NavLink = ({ href, className, ...props }: NavLinkProps) => {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn("inline-flex min-h-11 items-center", className)}
      {...props}
    />
  );
};
