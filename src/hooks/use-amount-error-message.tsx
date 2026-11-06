"use client";

import { useTranslations } from "next-intl";

import { donationConfig } from "@/config/donation";
import type { CustomAmountError } from "@/hooks/use-amount-choice";
import { useFormatMoney } from "@/hooks/use-format-money";
import { Link } from "@/i18n/navigation";

/** Returns the custom-amount error as rich text, linking to Contact for gifts over the maximum. */
export const useAmountErrorMessage = (error: CustomAmountError) => {
  const t = useTranslations("QuickGive");
  const formatMoney = useFormatMoney();

  if (error === "min") return t("errorMin", { min: formatMoney(donationConfig.minCents) });
  if (error === "invalid") return t("errorInvalid");
  if (error === "max") {
    return t.rich("errorMax", {
      max: formatMoney(donationConfig.maxCents),
      link: (chunks) => (
        <Link href="/contact" className="font-semibold underline underline-offset-2">
          {chunks}
        </Link>
      ),
    });
  }
  return null;
};
