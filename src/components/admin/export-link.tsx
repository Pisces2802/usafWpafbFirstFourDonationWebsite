import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/admin/access";
import type { AdminDataset } from "@/lib/admin/export";

/** Downloads a dataset as CSV through `/admin/export/[dataset]`, for roles that can export it. */
export const ExportLink = async ({ dataset }: { dataset: AdminDataset }) => {
  if (!(await hasPermission(`${dataset}:export`))) return null;
  const t = await getTranslations("Admin");

  return (
    <a
      href={`/admin/export/${dataset}`}
      download
      className={buttonVariants({ variant: "outline", size: "touch" })}
    >
      <Download aria-hidden="true" />
      {t("exportCsv")}
    </a>
  );
};
