import "../globals.css";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { siteConfig } from "@/config/site";

import { fontVariables } from "../fonts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  const suffix = t("titleSuffix", { orgName: siteConfig.orgName });

  return {
    title: { default: suffix, template: `%s | ${suffix}` },
    robots: { index: false, follow: false },
  };
}

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  const { Admin, Funds, Forms } = await getMessages();

  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="bg-background flex min-h-full flex-col">
        <NextIntlClientProvider messages={{ Admin, Funds, Forms }}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
