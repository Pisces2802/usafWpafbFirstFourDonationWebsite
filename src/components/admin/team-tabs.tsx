"use client";

import { ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AddAdminUserDialog } from "@/components/admin/add-admin-user-form";
import { InviteNotice } from "@/components/admin/invite-notice";
import { RolesPanel } from "@/components/admin/roles-panel";
import { TabList } from "@/components/admin/tab-list";
import { TabPanel } from "@/components/admin/tab-panel";
import { TeamTable } from "@/components/admin/team-table";
import type { AdminPermission } from "@/lib/admin/permissions";
import { canGrant } from "@/lib/admin/permissions";
import type { AdminRoleRow } from "@/lib/admin/role-queries";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

type TeamTabsProps = {
  members: AdminTeamRow[];
  roles: AdminRoleRow[];
  /** The person looking at the page and what their role allows. */
  viewer: { id: number; roleId: number; isSuper: boolean; permissions: AdminPermission[] };
};

type Added = { name: string; roleName: string; inviteLink: string | null };

/** The Team page body: People and Roles tabs, with the add-person dialog beside them. */
export const TeamTabs = ({ members, roles, viewer }: TeamTabsProps) => {
  const t = useTranslations("Admin");
  const [tab, setTab] = useState("people");
  const [added, setAdded] = useState<Added | null>(null);
  const held = new Set(viewer.permissions);
  // SuperAdmin is never given out here: there's one at a time, handed over from their row.
  const assignableRoles = roles.filter((role) => !role.isSuper && canGrant(viewer, role));

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
        {held.has("identity:create") && (
          <AddAdminUserDialog
            roles={assignableRoles}
            onAdded={(person) => {
              setAdded(person);
              setTab("people");
            }}
          />
        )}
      </div>
      {added && (
        <InviteNotice
          link={added.inviteLink}
          message={t(added.inviteLink ? "team.inviteNotSent" : "team.inviteSent", {
            name: added.name,
            role: added.roleName,
          })}
        />
      )}
      <TabPanel selected={tab} value="people" className="outline-none">
        <TeamTable
          members={members}
          currentUserId={viewer.id}
          assignableRoles={assignableRoles}
          handOverRoles={roles.filter((role) => !role.isSuper)}
          abilities={{
            create: held.has("identity:create"),
            edit: held.has("identity:edit"),
            deactivate: held.has("identity:deactivate"),
            lock: held.has("auth:lock"),
            resetTwoFactor: held.has("auth:reset-2fa"),
            signOut: held.has("auth:sessions"),
            handOverSuperAdmin: viewer.isSuper,
          }}
          canActOn={(member) =>
            canGrant(viewer, { isSuper: member.roleIsSuper, permissions: member.rolePermissions })
          }
        />
      </TabPanel>
      <TabPanel selected={tab} value="roles" className="outline-none">
        <RolesPanel
          roles={roles}
          viewer={{ ...viewer, canManageRoles: held.has("identity:roles") }}
        />
      </TabPanel>
    </div>
  );
};
