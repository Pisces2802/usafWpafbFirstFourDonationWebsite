"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { CircleCheck, Eye, Pencil, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";

import { DataTable, type DataTableFeatures } from "@/components/admin/data-table";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AdminPermission,
  canGrant,
  grantedPermissions,
  builtInOnlyReason,
  conflictWith,
  isBuiltInOnly,
  isSecurityPermission,
  PERMISSION_GROUP_KEYS,
  PERMISSION_GROUPS,
  requiresTwoFactor,
  withImpliedPermissions,
} from "@/lib/admin/permissions";
import { createRole, deleteRole, updateRole } from "@/lib/admin/role-actions";
import { createColumns } from "@/config/columns/core";
import type { AdminRoleRow } from "@/lib/admin/role-queries";
import type { TeamError } from "@/lib/admin/team-schema";
import { cn } from "@/lib/utils";

export type RolesViewer = {
  roleId: number;
  isSuper: boolean;
  permissions: AdminPermission[];
  canManageRoles: boolean;
};

type RoleFormError = TeamError | "unknown" | "roleName";

type Notice =
  | { kind: "success"; key: "roleCreated" | "roleUpdated" | "roleDeleted"; role: string }
  | { kind: "error"; error: TeamError | "unknown" };

type Editing =
  { mode: "create"; role: null } | { mode: "edit" | "view"; role: AdminRoleRow } | null;

/** Removes an area's other permissions when its `read` is unticked, since they need it. */
const without = (selected: Set<AdminPermission>, permission: AdminPermission) => {
  const next = new Set(selected);
  next.delete(permission);
  const [area, action] = permission.split(":");
  if (action === "read") {
    for (const other of selected) if (other.startsWith(`${area}:`)) next.delete(other);
    if (area === "identity")
      for (const other of selected) if (other.startsWith("auth:")) next.delete(other);
  }
  return next;
};

const RoleFormDialog = ({
  editing,
  viewer,
  onClose,
  onSaved,
}: {
  editing: Editing;
  viewer: RolesViewer;
  onClose: () => void;
  onSaved: (notice: Notice) => void;
}) => {
  const t = useTranslations("Admin");
  const role = editing?.role ?? null;
  const readOnly = editing?.mode === "view";
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState(
    () => new Set(role ? grantedPermissions(role) : ([] as AdminPermission[])),
  );
  const [error, setError] = useState<RoleFormError | null>(null);
  const [isSaving, startSaving] = useTransition();
  const held = new Set(viewer.permissions);
  /**
   * Why a permission can't be ticked here, or null if it can: kept to built-in roles, would mix
   * duties that must be split, or not yours to give. Unticking is always allowed.
   */
  const blockedBecause = (permission: AdminPermission): string | null => {
    if (readOnly || selected.has(permission)) return null;
    const builtInOnly = builtInOnlyReason(permission);
    if (builtInOnly) return t(`team.roles.form.builtInOnly.${builtInOnly}`);
    const conflict = conflictWith(selected, permission);
    if (conflict) return t(`team.roles.form.conflicts.${conflict}`);
    if (!viewer.isSuper && !held.has(permission)) return t("team.roles.form.notYours");
    return null;
  };
  // A group that's only for built-in roles (site settings) shows when looking, not when editing.
  const groups = PERMISSION_GROUP_KEYS.filter(
    (group) =>
      readOnly || !(PERMISSION_GROUPS[group] as readonly AdminPermission[]).every(isBuiltInOnly),
  );

  const toggle = (permission: AdminPermission, checked: boolean) =>
    setSelected((current) =>
      checked
        ? new Set(withImpliedPermissions([...current, permission]))
        : without(current, permission),
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("roleName");
      return;
    }
    const input = { name, description, permissions: [...selected] };
    startSaving(async () => {
      try {
        const result = role ? await updateRole(role.id, input) : await createRole(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSaved({ kind: "success", key: role ? "roleUpdated" : "roleCreated", role: name.trim() });
      } catch {
        setError("unknown");
      }
    });
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("team.close")} className="gap-5 p-5 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {readOnly && role
              ? t("team.roles.form.viewTitle", { role: role.name })
              : role
                ? t("team.roles.form.editTitle", { role: role.name })
                : t("team.roles.form.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {readOnly ? role?.description : t("team.roles.form.permissionsHint")}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <div className={cn("grid gap-4 sm:grid-cols-2", readOnly && "hidden")}>
            <TextField
              id="role-name"
              label={t("team.roles.form.name")}
              maxLength={60}
              autoComplete="off"
              readOnly={readOnly}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              id="role-description"
              label={t("team.roles.form.description")}
              hint={t("team.roles.form.descriptionHint")}
              maxLength={200}
              autoComplete="off"
              readOnly={readOnly}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">{t("team.roles.form.permissions")}</legend>
            {readOnly ? (
              role?.isBuiltIn && (
                <p className="text-muted-foreground text-sm">
                  {role.isSuper ? t("team.roles.everything") : t("team.roles.form.viewHint")}
                </p>
              )
            ) : (
              <p className="text-muted-foreground text-sm">{t("team.roles.form.dutiesNote")}</p>
            )}
            <div className="grid max-h-[50vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              {groups.map((group) => {
                const permissions = PERMISSION_GROUPS[group] as readonly AdminPermission[];
                const isSecurity = isSecurityPermission(permissions[0]!);
                return (
                  <div
                    key={group}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border p-3",
                      isSecurity && "border-taxiway/60 bg-taxiway/5",
                    )}
                  >
                    <p className="text-sm font-semibold">{t(`permissionGroups.${group}`)}</p>
                    {isSecurity && (
                      <p className="text-muted-foreground text-xs">
                        {t("team.roles.form.securityHint")}
                      </p>
                    )}
                    {permissions.map((permission) => {
                      const blocked = blockedBecause(permission);
                      const disabled = readOnly || blocked !== null;
                      const reasonId = `role-permission-${permission.replace(":", "-")}-reason`;
                      return (
                        <label
                          key={permission}
                          className={cn(
                            "flex min-h-8 items-start gap-2.5 text-sm",
                            blocked && "text-muted-foreground",
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.has(permission)}
                            disabled={disabled}
                            aria-describedby={blocked ? reasonId : undefined}
                            onCheckedChange={(checked) => toggle(permission, checked === true)}
                          />
                          <span>
                            {t(`permissions.${permission}`)}
                            <span className="text-muted-foreground block font-mono text-[0.7rem]">
                              {permission}
                            </span>
                            {blocked && (
                              <span id={reasonId} className="text-muted-foreground block text-xs">
                                {blocked}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t(`team.errors.${error}`)}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
              {readOnly ? t("team.close") : t("team.cancel")}
            </DialogClose>
            {!readOnly && (
              <Button type="submit" size="touch" disabled={isSaving}>
                {isSaving
                  ? t("team.roles.form.saving")
                  : t(role ? "team.roles.form.save" : "team.roles.form.create")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const column = createColumnHelper<DataTableFeatures, AdminRoleRow>();

const Badge = ({ className, children }: { className: string; children: string }) => (
  <span className={cn("rounded-full px-2 py-0.5 text-xs font-normal", className)}>{children}</span>
);

/** Every role in a table, with what it grants; built-in roles can only be looked at. */
const RolesTable = ({
  roles,
  viewer,
  onView,
  onEdit,
  onDelete,
}: {
  roles: AdminRoleRow[];
  viewer: RolesViewer;
  onView: (role: AdminRoleRow) => void;
  onEdit: (role: AdminRoleRow) => void;
  onDelete: (role: AdminRoleRow) => void;
}) => {
  const t = useTranslations("Admin");
  // Custom roles only, and only ones you could have made: nobody edits their own role.
  const mayChange = (role: AdminRoleRow) =>
    viewer.canManageRoles && !role.isBuiltIn && role.id !== viewer.roleId && canGrant(viewer, role);

  const columns = createColumns<AdminRoleRow>({
    columns: column.columns([
      column.accessor("name", {
        header: t("team.roles.columns.role"),
        cell: (info) => {
          const role = info.row.original;
          return (
            <span className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {role.name}
                {role.isBuiltIn && (
                  <Badge className="bg-muted text-muted-foreground">
                    {t("team.roles.builtIn")}
                  </Badge>
                )}
                {role.id === viewer.roleId && (
                  <Badge className="bg-primary/10 text-primary">{t("team.roles.yours")}</Badge>
                )}
              </span>
              {role.description && (
                <span className="text-muted-foreground max-w-md text-xs whitespace-normal">
                  {role.description}
                </span>
              )}
            </span>
          );
        },
      }),
      column.accessor("memberCount", {
        header: t("team.roles.columns.people"),
        cell: (info) => t("team.roles.members", { count: info.getValue() }),
      }),
      column.accessor((role) => (role.isSuper ? Infinity : grantedPermissions(role).size), {
        id: "permissions",
        header: t("team.roles.columns.permissions"),
        cell: (info) =>
          info.row.original.isSuper
            ? t("team.roles.everything")
            : t("team.roles.permissionCount", { count: info.getValue() }),
      }),
      column.accessor((role) => requiresTwoFactor(grantedPermissions(role)), {
        id: "twoFactor",
        header: t("team.roles.columns.twoFactor"),
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600" />
              {t("team.roles.twoFactorRequired")}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("team.roles.twoFactorOptional")}</span>
          ),
      }),
    ]),
    actionsLabel: (role) => t("table.actionsFor", { name: role.name }),
    actions: (role) => [
      { label: t("team.roles.view"), icon: Eye, onClick: onView },
      { label: t("team.roles.edit"), icon: Pencil, hidden: !mayChange(role), onClick: onEdit },
      {
        label: t("team.roles.delete"),
        icon: Trash2,
        variant: "destructive",
        hidden: !mayChange(role) || role.memberCount > 0,
        onClick: onDelete,
      },
    ],
  });

  return (
    <DataTable
      columns={columns}
      data={roles}
      getRowId={(role) => String(role.id)}
      caption={(count) => t("rowCount", { count })}
      empty={t("team.roles.empty")}
    />
  );
};

/** The Roles tab: every role with what it grants, and adding, changing or deleting roles. */
export const RolesPanel = ({ roles, viewer }: { roles: AdminRoleRow[]; viewer: RolesViewer }) => {
  const t = useTranslations("Admin");
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminRoleRow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="roles-heading" className="sr-only">
            {t("team.rolesHeading")}
          </h2>
          <p className="text-muted-foreground">{t("team.rolesLead")}</p>
        </div>
        {viewer.canManageRoles && (
          <Button
            type="button"
            size="touch"
            onClick={() => {
              setNotice(null);
              setEditing({ mode: "create", role: null });
            }}
          >
            <Plus aria-hidden="true" />
            {t("team.roles.new")}
          </Button>
        )}
      </div>

      {notice && (
        <div aria-live="polite">
          {notice.kind === "error" ? (
            <p role="alert" className="text-destructive inline-flex items-center gap-2 text-sm">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {t(`team.errors.${notice.error}`)}
            </p>
          ) : (
            <p role="status" className="inline-flex items-center gap-2 text-sm">
              <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
              {t(`team.notices.${notice.key}`, { role: notice.role })}
            </p>
          )}
        </div>
      )}

      <RolesTable
        roles={roles}
        viewer={viewer}
        onView={(role) => setEditing({ mode: "view", role })}
        onEdit={(role) => {
          setNotice(null);
          setEditing({ mode: "edit", role });
        }}
        onDelete={setDeleting}
      />

      {editing && (
        <RoleFormDialog
          key={`${editing.mode}-${editing.role?.id ?? "new"}`}
          editing={editing}
          viewer={viewer}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice(saved);
          }}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent closeLabel={t("team.close")} className="gap-5 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {t("team.roles.deleteDialog.title", { role: deleting?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("team.roles.deleteDialog.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
              {t("team.cancel")}
            </DialogClose>
            <Button
              type="button"
              size="touch"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                startDeleting(async () => {
                  try {
                    const result = await deleteRole(target.id);
                    setNotice(
                      result.ok
                        ? { kind: "success", key: "roleDeleted", role: target.name }
                        : { kind: "error", error: result.error },
                    );
                  } catch {
                    setNotice({ kind: "error", error: "unknown" });
                  } finally {
                    setDeleting(null);
                  }
                });
              }}
            >
              {t("team.roles.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
