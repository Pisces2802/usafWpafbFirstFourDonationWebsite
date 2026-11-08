import { ShieldX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AdminPage } from "@/components/admin/admin-page";

const Forbidden = async () => {
  const t = await getTranslations("Admin.forbidden");

  return (
    <AdminPage title={t("title")}>
      <div className="bg-card ring-foreground/10 flex gap-4 rounded-xl p-6 ring-1">
        <ShieldX aria-hidden="true" className="text-muted-foreground mt-0.5 size-6 shrink-0" />
        <div className="max-w-2xl">
          <p>{t("body")}</p>
          <Link
            href="/admin"
            className="text-primary mt-3 inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
          >
            {t("back")}
          </Link>
        </div>
      </div>
    </AdminPage>
  );
};

export default Forbidden;
