import { getFormatter, getTranslations } from "next-intl/server";

import { campaignName } from "@/lib/admin/catalog-schema";
import type { AdminDashboardInsights } from "@/lib/admin/queries";
import { MONEY_FORMAT } from "@/lib/money";

/** The campaigns that have raised the most, each with a bar showing progress to its goal. */
export const CampaignProgress = async ({
  campaigns,
}: {
  campaigns: AdminDashboardInsights["campaigns"];
}) => {
  const t = await getTranslations("Admin.dashboard.campaigns");
  const format = await getFormatter();
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);

  if (!campaigns.length) return <p className="text-muted-foreground text-sm">{t("empty")}</p>;

  return (
    <ul className="flex flex-col gap-5">
      {campaigns.map((campaign) => {
        const ratio = campaign.goalCents > 0 ? campaign.raisedCents / campaign.goalCents : 0;
        const percent = format.number(ratio, { style: "percent", maximumFractionDigits: 0 });
        const name = campaignName(campaign.slug);

        return (
          <li key={campaign.slug} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-medium">{name}</span>
              <span className="text-sm font-semibold tabular-nums">{percent}</span>
            </div>
            <div
              role="progressbar"
              aria-label={name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(Math.round(ratio * 100), 100)}
              aria-valuetext={percent}
              className="bg-muted h-2 overflow-hidden rounded-full"
            >
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("raised", {
                amount: money(campaign.raisedCents),
                goal: money(campaign.goalCents),
              })}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
