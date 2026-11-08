import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/admin/auth/forgot-password-form";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("Admin.auth.forgot");
  return { title: t("title") };
};

const ForgotPasswordPage = () => <ForgotPasswordForm />;

export default ForgotPasswordPage;
