"use client";

import { useEffect, useState } from "react";

import { usePathname } from "@/i18n/navigation";

export const HERO_ID = "hero";

/**
 * Decides when the mobile sticky donate bar shows: once the `#hero` element has scrolled out
 * of view, or after one viewport of scrolling on pages without a hero. Never on the donate page.
 */
export const useStickyDonateBar = () => {
  const pathname = usePathname();
  const isDonatePage = pathname === "/donate" || pathname.startsWith("/donate/");
  const [isPastHero, setIsPastHero] = useState(false);

  useEffect(() => {
    if (isDonatePage) return;

    const hero = document.getElementById(HERO_ID);

    if (hero) {
      const observer = new IntersectionObserver(([entry]) =>
        setIsPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      );
      observer.observe(hero);
      return () => observer.disconnect();
    }

    const onScroll = () => setIsPastHero(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDonatePage, pathname]);

  return { isVisible: !isDonatePage && isPastHero };
};
