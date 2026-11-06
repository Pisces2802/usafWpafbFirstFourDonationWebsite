"use client";

import { useParams } from "next/navigation";
import type { ComponentProps } from "react";

import { Link, usePathname } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

/**
 * Returns an href for the current route that next-intl's `Link` can render in any locale,
 * so a language switch keeps the visitor on the equivalent localised page.
 */
export const useLocaleHref = (): Href => {
  const pathname = usePathname();
  const params = Object.fromEntries(
    Object.entries(useParams()).filter(([key]) => key !== "locale"),
  );

  return (Object.keys(params).length ? { pathname, params } : pathname) as Href;
};
