import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthHeading } from "@/components/admin/auth/auth-parts";

/** Shown for an expired, used or mistyped invite or reset link. */
export const LinkInvalid = async () => {
  const t = await getTranslations("Admin.auth.linkInvalid");

  return (
    <>
      <AuthHeading title={t("title")} lead={t("body")} />
      <div className="flex flex-col items-start gap-1">
        <Link
          href="/admin/forgot-password"
          className="text-primary inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("reset")}
        </Link>
        <Link
          href="/admin/sign-in"
          className="text-primary inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
      </div>
    </>
  );
};
