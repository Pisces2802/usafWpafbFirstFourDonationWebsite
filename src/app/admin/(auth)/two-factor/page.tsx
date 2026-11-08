import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { TwoFactorSetup } from "@/components/admin/auth/two-factor-setup";
import { TwoFactorVerify } from "@/components/admin/auth/two-factor-verify";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import { searchParam } from "@/lib/admin/auth/pages";
import { readSession } from "@/lib/admin/auth/session";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.twoFactor");
  return { title: t("title") };
};

/** The code step after the password: set up an app the first time, enter a code after that. */
const TwoFactor = async ({
  searchParams,
}: Pick<PageProps<"/admin/two-factor">, "searchParams">) => {
  const next = searchParam((await searchParams).next);
  const current = await readSession();
  if (current?.session.stage === "active") redirect(safeNextPath(next));
  if (!current) redirect("/admin/sign-in");

  return current.user.totpSecret ? <TwoFactorVerify next={next} /> : <TwoFactorSetup next={next} />;
};

const TwoFactorPage = ({ searchParams }: PageProps<"/admin/two-factor">) => (
  <Suspense>
    <TwoFactor searchParams={searchParams} />
  </Suspense>
);

export default TwoFactorPage;
