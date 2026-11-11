"use client";

import {
  Bell,
  Building2,
  type LucideIcon,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TabList } from "@/components/admin/tab-list";
import { TabPanel } from "@/components/admin/tab-panel";
import { useSettingsTab } from "@/hooks/use-settings-tab";

export type SettingsTab = "account" | "security" | "notifications" | "preferences" | "platform";

const ICONS: Record<SettingsTab, LucideIcon> = {
  account: UserRound,
  security: ShieldCheck,
  notifications: Bell,
  preferences: SlidersHorizontal,
  platform: Building2,
};

type SettingsTabsProps = {
  /** Panels rendered on the server, in tab order. Leave one out to hide its tab. */
  panels: Partial<Record<SettingsTab, ReactNode>>;
  /** The `?tab=` the page was opened with. */
  initialTab?: string;
};

export const SettingsTabs = ({ panels, initialTab }: SettingsTabsProps) => {
  const t = useTranslations("Admin.settings.tabs");
  const available = (Object.keys(ICONS) as SettingsTab[]).filter((key) => panels[key]);
  const { tab, changeTab } = useSettingsTab(available, initialTab);

  return (
    <div className="flex flex-col gap-6">
      <TabList
        label={t("label")}
        tab={tab}
        onTabChange={changeTab}
        tabs={available.map((key) => ({ value: key, label: t(key), icon: ICONS[key] }))}
      />
      {available.map((key) => (
        <TabPanel key={key} selected={tab} value={key} className="outline-none">
          <div className="flex flex-col gap-6">{panels[key]}</div>
        </TabPanel>
      ))}
    </div>
  );
};
