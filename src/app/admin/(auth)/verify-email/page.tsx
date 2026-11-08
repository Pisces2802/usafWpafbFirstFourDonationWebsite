import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthHeading } from "@/components/admin/auth/auth-parts";
import { LinkInvalid } from "@/components/admin/auth/link-invalid";
import { SetPasswordForm } from "@/components/admin/auth/set-password-form";
import { lookUpLink, searchParam } from "@/lib/admin/auth/pages";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.verify");
  return { title: t("pageTitle") };
};

const VerifyEmail = async ({
  searchParams,
}: Pick<PageProps<"/admin/verify-email">, "searchParams">) => {
  const token = searchParam((await searchParams).token);
  const person = await lookUpLink("verify_email", token);
  if (!person || !token) return <LinkInvalid />;

  const t = await getTranslations("Admin.auth.verify");

  return (
    <>
      <AuthHeading title={t("title", { name: person.name })} lead={t("lead")} />
      <SetPasswordForm purpose="verify" token={token} email={person.email} />
    </>
  );
};

const VerifyEmailPage = ({ searchParams }: PageProps<"/admin/verify-email">) => (
  <Suspense>
    <VerifyEmail searchParams={searchParams} />
  </Suspense>
);

export default VerifyEmailPage;
