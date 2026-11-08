import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminPage, TableSkeleton } from "@/components/admin/admin-page";
import {
  ChangePasswordForm,
  NameForm,
  RecoveryCodesPanel,
  SessionsPanel,
} from "@/components/admin/settings-forms";
import {
  NotificationsForm,
  PlatformForm,
  PreferencesForm,
} from "@/components/admin/settings-preference-forms";
import { SettingsSection } from "@/components/admin/settings-section";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { requireAdmin } from "@/lib/admin/access";
import { searchParam } from "@/lib/admin/auth/pages";
import { countOtherSessions, countUnusedRecoveryCodes } from "@/lib/admin/auth/queries";
import { readSession } from "@/lib/admin/auth/session";
import { adminMetadata } from "@/lib/admin/metadata";
import { can } from "@/lib/admin/permissions";
import { getPlatformSettingsForEditing } from "@/lib/admin/platform-settings";
import { isEmailConfigured } from "@/lib/emails";

export const generateMetadata = adminMetadata("settings");

/** Every IANA zone the runtime knows, for the time zone picker. */
const timeZones = () => {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
};

const Settings = async ({ searchParams }: Pick<PageProps<"/admin/settings">, "searchParams">) => {
  const user = await requireAdmin();
  const current = (await readSession())!;
  const person = current.user;
  const canManagePlatform = can(user.role, "settings:manage");
  const [remaining, otherSessions, platform, { tab }] = await Promise.all([
    countUnusedRecoveryCodes(current.db, user.id),
    countOtherSessions(current.db, user.id, current.session.id),
    canManagePlatform ? getPlatformSettingsForEditing(current.db) : null,
    searchParams,
  ]);
  const t = await getTranslations("Admin");

  return (
    <SettingsTabs
      initialTab={searchParam(tab)}
      panels={{
        account: (
          <SettingsSection id="settings-profile" title={t("settings.profile.title")}>
            <dl className="mb-5 grid max-w-md gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("settings.profile.email")}</dt>
                <dd className="font-medium break-all">{user.email}</dd>
                <dd className="text-muted-foreground mt-1 text-xs">
                  {t("settings.profile.emailHint")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("settings.profile.role")}</dt>
                <dd className="font-medium">{t(`roles.${user.role}.name`)}</dd>
              </div>
            </dl>
            <NameForm name={user.name} />
          </SettingsSection>
        ),
        security: (
          <>
            <SettingsSection
              id="settings-password"
              title={t("settings.password.title")}
              lead={t("settings.password.lead")}
            >
              <ChangePasswordForm email={user.email} />
            </SettingsSection>
            <SettingsSection id="settings-two-factor" title={t("settings.twoFactor.title")}>
              <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium">
                <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600" />
                {t("settings.twoFactor.on")}
              </p>
              <RecoveryCodesPanel remaining={remaining} />
            </SettingsSection>
            <SettingsSection id="settings-sessions" title={t("settings.sessions.title")}>
              <SessionsPanel otherSessions={otherSessions} />
            </SettingsSection>
          </>
        ),
        notifications: (
          <SettingsSection
            id="settings-notifications"
            title={t("settings.notifications.title")}
            lead={t("settings.notifications.lead", { email: user.email })}
          >
            <NotificationsForm
              values={{
                notifyVolunteers: person.notifyVolunteers,
                notifyMessages: person.notifyMessages,
                notifySecurity: person.notifySecurity,
              }}
              canSee={{
                volunteers: can(user.role, "volunteers:view"),
                messages: can(user.role, "messages:view"),
              }}
              canEmail={isEmailConfigured()}
            />
          </SettingsSection>
        ),
        preferences: (
          <SettingsSection
            id="settings-preferences"
            title={t("settings.preferences.title")}
            lead={t("settings.preferences.lead")}
          >
            <PreferencesForm
              values={{ timeZone: person.timeZone ?? "", pageSize: String(person.pageSize) }}
              timeZones={timeZones()}
              siteTimeZone={siteConfig.timeZone}
            />
          </SettingsSection>
        ),
        platform: platform && (
          <SettingsSection
            id="settings-platform"
            title={t("settings.platform.title")}
            lead={t("settings.platform.lead")}
          >
            <PlatformForm
              values={{
                inboxEmail: platform.inboxEmail ?? "",
                donationsPaused: platform.donationsPaused,
                sessionHours: String(platform.sessionHours),
              }}
              fallbackInbox={env.ORG_NOTIFY_EMAIL ?? null}
              lastChange={
                platform.updatedAt ? { by: platform.updatedBy, at: platform.updatedAt } : null
              }
            />
          </SettingsSection>
        ),
      }}
    />
  );
};

const SettingsPage = async ({ searchParams }: PageProps<"/admin/settings">) => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.settings")} lead={t("settings.lead")}>
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  );
};

export default SettingsPage;
