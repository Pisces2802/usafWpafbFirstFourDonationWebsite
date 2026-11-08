import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { AdminPage, TableSkeleton } from "@/components/admin/admin-page";
import {
  ChangePasswordForm,
  NameForm,
  RecoveryCodesPanel,
  SessionsPanel,
} from "@/components/admin/settings-forms";
import { requireAdmin } from "@/lib/admin/access";
import { countOtherSessions, countUnusedRecoveryCodes } from "@/lib/admin/auth/queries";
import { readSession } from "@/lib/admin/auth/session";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("settings");

const Section = ({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) => (
  <section
    aria-labelledby={id}
    className="bg-card ring-foreground/10 grid gap-5 rounded-xl p-5 ring-1 lg:grid-cols-[16rem_1fr] lg:gap-8 lg:p-6"
  >
    <div>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {lead && <p className="text-muted-foreground mt-1 text-sm">{lead}</p>}
    </div>
    <div>{children}</div>
  </section>
);

const Settings = async () => {
  const user = await requireAdmin();
  const current = (await readSession())!;
  const [remaining, otherSessions] = await Promise.all([
    countUnusedRecoveryCodes(current.db, user.id),
    countOtherSessions(current.db, user.id, current.session.id),
  ]);
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-6">
      <Section id="settings-profile" title={t("settings.profile.title")}>
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
      </Section>
      <Section
        id="settings-password"
        title={t("settings.password.title")}
        lead={t("settings.password.lead")}
      >
        <ChangePasswordForm email={user.email} />
      </Section>
      <Section id="settings-two-factor" title={t("settings.twoFactor.title")}>
        <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium">
          <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600" />
          {t("settings.twoFactor.on")}
        </p>
        <RecoveryCodesPanel remaining={remaining} />
      </Section>
      <Section id="settings-sessions" title={t("settings.sessions.title")}>
        <SessionsPanel otherSessions={otherSessions} />
      </Section>
    </div>
  );
};

const SettingsPage = async () => {
  const t = await getTranslations("Admin");

  return (
    <AdminPage title={t("nav.settings")} lead={t("settings.lead")}>
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <Settings />
      </Suspense>
    </AdminPage>
  );
};

export default SettingsPage;
