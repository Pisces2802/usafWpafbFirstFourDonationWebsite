import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthAlert, AuthHeading, AuthNotice } from "@/components/admin/auth/auth-parts";
import { SignInForm } from "@/components/admin/auth/sign-in-form";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import { isSignInAvailable, searchParam } from "@/lib/admin/auth/pages";
import { readSession } from "@/lib/admin/auth/session";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.signIn");
  return { title: t("title") };
};

const SignIn = async ({ searchParams }: Pick<PageProps<"/admin/sign-in">, "searchParams">) => {
  const params = await searchParams;
  const next = searchParam(params.next);
  const current = await readSession();
  if (current?.session.stage === "active") redirect(safeNextPath(next));

  const t = await getTranslations("Admin.auth");
  if (!isSignInAvailable()) return <AuthAlert>{t("unavailable")}</AuthAlert>;

  return (
    <div className="flex flex-col gap-5">
      {params.reset && <AuthNotice>{t("signIn.resetDone")}</AuthNotice>}
      <SignInForm next={next} />
    </div>
  );
};

const SignInPage = async ({ searchParams }: PageProps<"/admin/sign-in">) => {
  const t = await getTranslations("Admin.auth.signIn");

  return (
    <>
      <AuthHeading title={t("title")} lead={t("lead")} />
      <Suspense>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </>
  );
};

export default SignInPage;
