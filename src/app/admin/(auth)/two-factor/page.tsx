import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { type TwoFactorMethod, TwoFactorSetup } from "@/components/admin/auth/two-factor-setup";
import { TwoFactorVerify } from "@/components/admin/auth/two-factor-verify";
import { safeNextPath } from "@/lib/admin/auth/cookie";
import { emailCodesAvailable } from "@/lib/admin/auth/email-code";
import { searchParam } from "@/lib/admin/auth/pages";
import { readSession } from "@/lib/admin/auth/session";
import { roleNeedsTwoFactor } from "@/lib/admin/auth/sign-in";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.twoFactor");
  return { title: t("title") };
};

/**
 * The step after the password: enter a code for someone who has a second step, or choose one
 * after an invite. Someone already signed in lands here too when their role starts needing one.
 */
const TwoFactor = async ({
  searchParams,
}: Pick<PageProps<"/admin/two-factor">, "searchParams">) => {
  const next = searchParam((await searchParams).next);
  const current = await readSession();
  if (!current) redirect("/admin/sign-in");

  const { session, user, role } = current;
  const required = roleNeedsTwoFactor(role);
  const methods: TwoFactorMethod[] = emailCodesAvailable()
    ? ["authenticator", "email"]
    : ["authenticator"];

  if (session.stage === "active") {
    if (user.twoFactorMethod || !required) redirect(safeNextPath(next));
    return (
      <TwoFactorSetup
        email={user.email}
        next={next}
        required
        context="signedIn"
        methods={methods}
      />
    );
  }

  return user.twoFactorMethod ? (
    <TwoFactorVerify method={user.twoFactorMethod} email={user.email} next={next} />
  ) : (
    <TwoFactorSetup
      email={user.email}
      next={next}
      required={required}
      context="invite"
      methods={methods}
    />
  );
};

const TwoFactorPage = ({ searchParams }: PageProps<"/admin/two-factor">) => (
  <Suspense>
    <TwoFactor searchParams={searchParams} />
  </Suspense>
);

export default TwoFactorPage;
