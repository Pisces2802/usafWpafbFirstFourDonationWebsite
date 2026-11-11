import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { Header } from "@/components/admin/header";
import { SidebarFallback } from "@/components/admin/sidebar";
import { WithPreferences } from "@/components/admin/with-preferences";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Admin");

  return (
    <>
      <a
        href="#main"
        className="bg-taxiway text-night sr-only z-50 rounded-md px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>
      <Header />
      <div className="flex flex-1 flex-col lg:flex-row">
        <Suspense fallback={<SidebarFallback />}>
          <AdminNav />
        </Suspense>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <Suspense>
            <WithPreferences>{children}</WithPreferences>
          </Suspense>
        </main>
      </div>
    </>
  );
}
