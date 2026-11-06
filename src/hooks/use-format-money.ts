"use client";

import { useFormatter } from "next-intl";
import { useCallback } from "react";

import { MONEY_FORMAT } from "@/lib/money";

/**
 * Formats cents as USD for the active locale ("$100", "100 $US"), dropping ".00" on whole amounts
 * while keeping cents when they exist.
 */
export const useFormatMoney = () => {
  const format = useFormatter();
  return useCallback((cents: number) => format.number(cents / 100, MONEY_FORMAT), [format]);
};
