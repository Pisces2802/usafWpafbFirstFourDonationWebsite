"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LocaleLinks } from "@/components/layout/locale-links";
import { NavLink } from "@/components/layout/nav-link";
import { buttonVariants } from "@/components/ui/button";
import { mainNav } from "@/config/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const MobileMenu = () => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label={t("Header.openMenu")}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-touch" }),
          "text-white hover:bg-white/10 hover:text-white lg:hidden",
        )}
      >
        <Menu aria-hidden="true" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="bg-night/60 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 fixed inset-0 z-50 motion-reduce:animate-none" />
        <DialogPrimitive.Popup className="surface-night data-closed:animate-out data-closed:slide-out-to-right data-open:animate-in data-open:slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-8 overflow-y-auto px-6 pt-4 pb-8 outline-none motion-reduce:animate-none">
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="font-condensed text-2xl">
              {t("Header.menuTitle")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t("Common.close")}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-touch" }),
                "text-white hover:bg-white/10 hover:text-white",
              )}
            >
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <nav aria-label={t("Header.mainNavLabel")}>
            <ul className="flex flex-col gap-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    onClick={close}
                    className="font-condensed aria-[current=page]:text-taxiway w-full text-3xl"
                  >
                    {t(`Pages.${item.labelKey}`)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <Link
            href="/donate"
            onClick={close}
            className={cn(buttonVariants({ variant: "donate", size: "touch" }), "w-full")}
          >
            {t("Common.donateNow")}
          </Link>

          <section aria-labelledby="mobile-language-heading" className="mt-auto">
            <h2 id="mobile-language-heading" className="text-muted-foreground text-sm">
              {t("LocaleSwitcher.label")}
            </h2>
            <LocaleLinks onNavigate={close} className="mt-2 flex flex-wrap gap-x-6" />
          </section>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
