import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { AdminPreferencesProvider } from "@/components/admin/preferences-provider";
import { siteConfig } from "@/config/site";
import { readSession } from "@/lib/admin/auth/session";

/**
 * Applies the signed-in person's preferences to the page: dates in their time zone, and their
 * rows per page in tables. Signed-out visitors get the site defaults.
 */
export const WithPreferences = async ({ children }: { children: ReactNode }) => {
  const [current, { Admin, Funds, Forms }] = await Promise.all([readSession(), getMessages()]);
  const user = current?.session.stage === "active" ? current.user : null;

  return (
    <NextIntlClientProvider
      messages={{ Admin, Funds, Forms }}
      timeZone={user?.timeZone ?? siteConfig.timeZone}
    >
      <AdminPreferencesProvider pageSize={user?.pageSize ?? 10}>
        {children}
      </AdminPreferencesProvider>
    </NextIntlClientProvider>
  );
};
