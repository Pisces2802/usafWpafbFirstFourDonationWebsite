import { ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { getAdminUser } from "@/lib/admin/access";
import { signOut } from "@/lib/admin/auth/actions";

const CurrentUser = async () => {
  const t = await getTranslations("Admin");
  const user = await getAdminUser();
  if (!user) return null;

  return (
    <span className="text-muted-foreground hidden items-center gap-2 text-sm sm:inline-flex">
      <UserRound aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("signedInAs", { name: user.name })}</span>
      <span aria-hidden="true">{user.name}</span>
      <span className="bg-background/10 rounded-full px-2 py-0.5 text-xs">
        {t(`roles.${user.role}.name`)}
      </span>
    </span>
  );
};

const SignOut = async () => {
  const t = await getTranslations("Admin");
  if (!(await getAdminUser())) return null;

  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" className="min-h-11 gap-2 px-3">
        <LogOut aria-hidden="true" />
        {t("signOut")}
      </Button>
    </form>
  );
};

export const Header = async () => {
  const t = await getTranslations("Admin");

  return (
    <header className="surface-night sticky top-0 z-40 border-b">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <Link
          href="/admin"
          className="mr-auto inline-flex min-h-11 items-center gap-2.5 rounded-sm"
        >
          <LogoMark />
          <span className="font-condensed text-xl leading-none">
            {t("titleSuffix", { orgName: siteConfig.orgName })}
          </span>
        </Link>
        <Suspense>
          <CurrentUser />
        </Suspense>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
        >
          {t("viewSite")}
          <ExternalLink aria-hidden="true" className="size-4" />
        </Link>
        <Suspense>
          <SignOut />
        </Suspense>
      </div>
    </header>
  );
};
