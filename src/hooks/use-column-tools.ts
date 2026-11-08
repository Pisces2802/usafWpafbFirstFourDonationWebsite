"use client";

import { useFormatter, useTranslations } from "next-intl";

import { MONEY_FORMAT } from "@/lib/money";

/**
 * What the column factories in `src/config/columns` need to render cells: translators for the
 * back office, forms and funds, and number formatting. Call it in the table component and pass
 * the result to the factory.
 */
export const useColumnTools = () => {
  const t = useTranslations("Admin");
  const tForms = useTranslations("Forms");
  const tFunds = useTranslations("Funds");
  const format = useFormatter();
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);

  return { t, tForms, tFunds, format, money };
};

export type ColumnTools = ReturnType<typeof useColumnTools>;
