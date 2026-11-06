"use client";

import { ChevronDown, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LocaleLinks } from "@/components/layout/locale-links";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const LocaleSwitcher = ({ className }: { className?: string }) => {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("current", { language: t("locale", { locale }) })}
        className={cn(
          buttonVariants({ variant: "ghost", size: "touch" }),
          "px-3 text-white hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white",
          className,
        )}
      >
        <Languages aria-hidden="true" />
        <span aria-hidden="true">{locale.toUpperCase()}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 opacity-70 transition-transform duration-200 group-aria-expanded/button:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <LocaleLinks
          onNavigate={() => setOpen(false)}
          linkClassName="w-full rounded-md px-3 hover:bg-muted hover:no-underline"
        />
      </PopoverContent>
    </Popover>
  );
};
