"use client";

import { ArrowDown, ArrowUp, PiggyBank } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic } from "react";

import { CatalogNotice } from "@/components/admin/catalog-notice";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DateCell } from "@/config/columns/core";
import { useCatalogAction } from "@/hooks/use-catalog-action";
import { changeFundAccess, reorderFunds } from "@/lib/admin/catalog-actions";
import type { AdminFundRow } from "@/lib/admin/catalog-queries";
import { MONEY_FORMAT } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The funds donors choose from, in the order they see them. Each can be switched off (at least
 * one stays on) or moved up and down; changes save straight away and reach the site at once.
 */
export const FundsList = ({ funds }: { funds: AdminFundRow[] }) => {
  const t = useTranslations("Admin.funds");
  const tFunds = useTranslations("Funds");
  const format = useFormatter();
  const action = useCatalogAction();
  const [shown, setShown] = useOptimistic(funds);
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);
  const activeCount = shown.filter((fund) => fund.isActive).length;

  const move = (index: number, offset: -1 | 1) => {
    const next = [...shown];
    const [fund] = next.splice(index, 1);
    if (!fund) return;
    next.splice(index + offset, 0, fund);
    const name = tFunds(`${fund.id}.name`);
    action.run(
      "order",
      async () => {
        setShown(next);
        return reorderFunds(next.map((item) => item.id));
      },
      t("notices.moved", { name, position: index + offset + 1 }),
    );
  };

  const toggle = (fund: AdminFundRow, isActive: boolean) => {
    const name = tFunds(`${fund.id}.name`);
    action.run(
      fund.id,
      async () => {
        setShown(shown.map((item) => (item.id === fund.id ? { ...item, isActive } : item)));
        return changeFundAccess(fund.id, isActive);
      },
      t(isActive ? "notices.turnedOn" : "notices.turnedOff", { name }),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <CatalogNotice notice={action.notice} />
      <ol className="flex flex-col gap-3">
        {shown.map((fund, index) => {
          const name = tFunds(`${fund.id}.name`);
          const switchId = `fund-${fund.id}-active`;
          const isLastOn = fund.isActive && activeCount === 1;

          return (
            <li
              key={fund.id}
              className={cn(
                "bg-card ring-foreground/10 grid gap-5 rounded-2xl p-5 ring-1 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center",
                !fund.isActive && "bg-muted/50",
              )}
            >
              <div className="flex items-center gap-3 md:flex-col md:gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={index === 0 || action.isPending}
                  aria-label={t("moveUp", { name })}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <span className="text-muted-foreground w-7 text-center text-sm font-semibold tabular-nums">
                  {index + 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={index === shown.length - 1 || action.isPending}
                  aria-label={t("moveDown", { name })}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <div className="flex min-w-0 gap-4">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    fund.isActive ? "bg-accent text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <PiggyBank aria-hidden="true" className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{name}</h2>
                    <span className="text-muted-foreground font-mono text-xs">{fund.id}</span>
                    {!fund.isActive && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {t("hidden")}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {tFunds(`${fund.id}.description`)}
                  </p>
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">{t("raised")}</dt>
                      <dd className="font-semibold tabular-nums">{money(fund.raisedCents)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">{t("gifts")}</dt>
                      <dd className="font-semibold tabular-nums">
                        {format.number(fund.giftCount)}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">{t("donors")}</dt>
                      <dd className="font-semibold tabular-nums">
                        {format.number(fund.donorCount)}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">{t("lastGift")}</dt>
                      <dd className="font-semibold">
                        <DateCell date={fund.lastGiftAt} />
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="flex items-center gap-3 md:flex-col md:items-end">
                <div className="flex items-center gap-3">
                  <label htmlFor={switchId} className="text-sm font-medium">
                    {t("showOnSite")}
                  </label>
                  <Switch
                    id={switchId}
                    checked={fund.isActive}
                    disabled={isLastOn || action.isPending}
                    onCheckedChange={(checked) => toggle(fund, checked)}
                  />
                </div>
                {isLastOn && <p className="text-muted-foreground text-xs">{t("lastOn")}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
