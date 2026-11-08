import { notFound } from "next/navigation";

import { exportDataset, isAdminDataset } from "@/lib/admin/export";
import { adminTranslator } from "@/lib/admin/translator";

export const GET = async (
  _request: Request,
  { params }: RouteContext<"/admin/export/[dataset]">,
) => {
  const { dataset } = await params;
  if (!isAdminDataset(dataset)) notFound();

  const csv = await exportDataset(dataset);
  if (csv === null) {
    return new Response(adminTranslator("unavailable"), { status: 503 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="firstfour-${dataset}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
};
