import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/admin/auth/forgot-password-form";
import { env } from "@/env";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.forgot");
  return { title: t("title") };
};

const ForgotPasswordPage = () => (
  <ForgotPasswordForm turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />
);

export default ForgotPasswordPage;
