"use client";

import { ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AddAdminUserDialog } from "@/components/admin/add-admin-user-form";
import { InviteNotice } from "@/components/admin/invite-notice";
import { TabList } from "@/components/admin/tab-list";
import { TabPanel } from "@/components/admin/tab-panel";
import { TeamTable } from "@/components/admin/team-table";
import type { AdminTeamRow } from "@/lib/admin/team-queries";
import type { AddedPerson } from "@/hooks/use-add-admin-user-form";

type TeamTabsProps = {
  members: AdminTeamRow[];
  currentUserId: number;
  /** The roles reference, rendered on the server. */
  roles: ReactNode;
};

/** The Team page body: People and Roles tabs, with the add-person dialog beside them. */
export const TeamTabs = ({ members, currentUserId, roles }: TeamTabsProps) => {
  const t = useTranslations("Admin");
  const [tab, setTab] = useState("people");
  const [added, setAdded] = useState<AddedPerson | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabList
          label={t("nav.team")}
          tab={tab}
          onTabChange={setTab}
          tabs={[
            { value: "people", label: t("team.tabs.people"), icon: Users },
            { value: "roles", label: t("team.tabs.roles"), icon: ShieldCheck },
          ]}
        />
        <AddAdminUserDialog
          onAdded={(person) => {
            setAdded(person);
            setTab("people");
          }}
        />
      </div>
      {added && (
        <InviteNotice
          link={added.inviteLink}
          message={t(added.inviteLink ? "team.inviteNotSent" : "team.inviteSent", {
            name: added.name,
            role: t(`roles.${added.role}.name`),
          })}
        />
      )}
      <TabPanel selected={tab} value="people" className="outline-none">
        <TeamTable members={members} currentUserId={currentUserId} />
      </TabPanel>
      <TabPanel selected={tab} value="roles" className="outline-none">
        {roles}
      </TabPanel>
    </div>
  );
};
