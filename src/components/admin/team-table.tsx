"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";

import { DataTable, type DataTableFeatures } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { InviteNotice } from "@/components/admin/invite-notice";
import { useTeamMember } from "@/hooks/use-team-member";
import { ADMIN_ROLES, isAdminRole } from "@/lib/admin/permissions";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

const column = createColumnHelper<DataTableFeatures, AdminTeamRow>();

const RowError = ({ error }: { error: string | null }) => {
  const t = useTranslations("Admin.team.errors");
  if (!error) return null;

  return (
    <p role="alert" className="text-destructive mt-1 max-w-64 text-xs whitespace-normal">
      {t(error as Parameters<typeof t>[0])}
    </p>
  );
};

const RoleSelect = ({ member }: { member: AdminTeamRow }) => {
  const t = useTranslations("Admin");
  const { isPending, error, changeRole } = useTeamMember(member.id);

  return (
    <div>
      <select
        aria-label={t("team.roleFor", { name: member.name })}
        value={member.role}
        disabled={isPending}
        onChange={(event) => {
          if (isAdminRole(event.target.value)) changeRole(event.target.value);
        }}
        className="border-input bg-background focus-visible:border-primary focus-visible:ring-primary/25 min-h-11 cursor-pointer rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 disabled:opacity-50"
      >
        {ADMIN_ROLES.map((role) => (
          <option key={role} value={role}>
            {t(`roles.${role}.name`)}
          </option>
        ))}
      </select>
      <RowError error={error} />
    </div>
  );
};

const ResendInvite = ({ member }: { member: AdminTeamRow }) => {
  const t = useTranslations("Admin.team");
  const { isPending, error, invite, resend } = useTeamMember(member.id);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="touch"
        variant="ghost"
        disabled={isPending}
        aria-label={t("resendInviteFor", { name: member.name })}
        onClick={resend}
        className="w-fit"
      >
        {isPending ? t("saving") : t("resendInvite")}
      </Button>
      {invite && (
        <div className="max-w-sm whitespace-normal">
          <InviteNotice
            link={invite.link}
            message={t(invite.link ? "resentNotSent" : "resent", { name: member.name })}
          />
        </div>
      )}
      <RowError error={error} />
    </div>
  );
};

const AccessToggle = ({ member, isSelf }: { member: AdminTeamRow; isSelf: boolean }) => {
  const t = useTranslations("Admin.team");
  const { isPending, error, setAccess } = useTeamMember(member.id);

  return (
    <div className="flex flex-col gap-2">
      {member.isActive && !member.emailVerifiedAt && <ResendInvite member={member} />}
      <Button
        type="button"
        size="touch"
        variant={member.isActive ? "outline" : "secondary"}
        disabled={isPending || isSelf}
        aria-label={
          member.isActive
            ? t("removeAccessFor", { name: member.name })
            : t("restoreAccessFor", { name: member.name })
        }
        onClick={() => setAccess(!member.isActive)}
      >
        {isPending ? t("saving") : member.isActive ? t("removeAccess") : t("restoreAccess")}
      </Button>
      <RowError error={error} />
    </div>
  );
};

type TeamTableProps = { members: AdminTeamRow[]; currentUserId: number };

/** Everyone with back-office access, with controls to change roles and remove access. */
export const TeamTable = ({ members, currentUserId }: TeamTableProps) => {
  const t = useTranslations("Admin");
  const format = useFormatter();

  const columns = column.columns([
    column.accessor("name", {
      header: t("team.columns.name"),
      cell: (info) => {
        const member = info.row.original;
        return (
          <span className="flex flex-col">
            <span className="flex items-center gap-2 font-medium">
              {member.name}
              {member.id === currentUserId && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                  {t("team.you")}
                </span>
              )}
              {member.isActive && !member.emailVerifiedAt && (
                <span className="bg-taxiway/15 text-foreground rounded-full px-2 py-0.5 text-xs">
                  {t("team.invited")}
                </span>
              )}
              {!member.isActive && (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                  {t("team.deactivated")}
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-xs">{member.email}</span>
          </span>
        );
      },
    }),
    column.accessor("role", {
      header: t("team.columns.role"),
      cell: (info) => <RoleSelect member={info.row.original} />,
    }),
    column.accessor("lastSignInAt", {
      header: t("team.columns.lastSignIn"),
      sortFn: "datetime",
      cell: (info) => {
        const value = info.getValue();
        return value ? format.dateTime(value, { dateStyle: "medium" }) : t("team.never");
      },
    }),
    column.accessor("isActive", {
      header: t("team.columns.access"),
      enableSorting: false,
      cell: (info) => (
        <AccessToggle member={info.row.original} isSelf={info.row.original.id === currentUserId} />
      ),
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={members}
      getRowId={(row) => String(row.id)}
      pageSize={50}
      caption={(count) => t("rowCount", { count })}
      empty={t("team.empty")}
    />
  );
};
