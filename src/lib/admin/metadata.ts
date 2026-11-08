import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { AdminNavKey } from "@/config/admin-navigation";

/** `generateMetadata` for a back-office page titled after its nav item. */
export const adminMetadata = (key: AdminNavKey) => async (): Promise<Metadata> => {
  const t = await getTranslations("Admin");
  return { title: t(`nav.${key}`) };
};
