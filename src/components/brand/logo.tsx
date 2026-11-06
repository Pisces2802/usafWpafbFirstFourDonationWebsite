import { cn } from "@/lib/utils";

import { siteConfig } from "@/config/site";

type LogoProps = {
  className?: string;
};

export const LogoMark = ({ className }: LogoProps) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
    <rect width="32" height="32" rx="6" fill="var(--ultramarine)" />
    <rect x="6" y="5" width="3" height="22" rx="1" fill="#ffffff" opacity="0.9" />
    <rect x="23" y="5" width="3" height="22" rx="1" fill="#ffffff" opacity="0.9" />
    <rect x="14.5" y="4" width="3" height="6" rx="1" fill="var(--taxiway)" />
    <rect x="14.5" y="13" width="3" height="6" rx="1" fill="var(--taxiway)" />
    <rect x="14.5" y="22" width="3" height="6" rx="1" fill="var(--taxiway)" />
  </svg>
);

export const Logo = ({ className }: LogoProps) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <LogoMark />
    <span className="font-condensed text-2xl leading-none">{siteConfig.orgName}</span>
  </span>
);
