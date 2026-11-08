import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthHeading } from "@/components/admin/auth/auth-parts";
import { LinkInvalid } from "@/components/admin/auth/link-invalid";
import { SetPasswordForm } from "@/components/admin/auth/set-password-form";
import { lookUpLink, searchParam } from "@/lib/admin/auth/pages";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.reset");
  return { title: t("title") };
};

const ResetPassword = async ({
  searchParams,
}: Pick<PageProps<"/admin/reset-password">, "searchParams">) => {
  const token = searchParam((await searchParams).token);
  const person = await lookUpLink("reset_password", token);
  if (!person || !token) return <LinkInvalid />;

  const t = await getTranslations("Admin.auth.reset");

  return (
    <>
      <AuthHeading title={t("title")} lead={t("lead")} />
      <SetPasswordForm purpose="reset" token={token} email={person.email} />
    </>
  );
};

const ResetPasswordPage = ({ searchParams }: PageProps<"/admin/reset-password">) => (
  <Suspense>
    <ResetPassword searchParams={searchParams} />
  </Suspense>
);

export default ResetPasswordPage;
