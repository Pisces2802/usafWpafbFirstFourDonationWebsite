"use client";

import { useFormatter, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";

import { PasswordField } from "@/components/admin/auth/password-field";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminRoleRow } from "@/lib/admin/role-queries";
import { handOverSuperAdmin } from "@/lib/admin/team-actions";
import type { AdminTeamRow } from "@/lib/admin/team-queries";
import type { TeamError } from "@/lib/admin/team-schema";

type DialogProps = {
  member: AdminTeamRow | null;
  onClose: () => void;
};

/** Picks a new role for someone; the change saves when they press Save. */
export const ChangeRoleDialog = ({
  member,
  roles,
  onClose,
  onSave,
}: DialogProps & {
  /** The roles the person changing it may give out. */
  roles: AdminRoleRow[];
  onSave: (member: AdminTeamRow, role: { id: number; name: string }) => void;
}) => {
  const t = useTranslations("Admin");
  const [roleId, setRoleId] = useState<string | null>(null);
  const items = roles.map((role) => ({ value: String(role.id), label: role.name }));
  const selected = roleId ?? (member ? String(member.roleId) : "");
  const selectedRole = roles.find((role) => String(role.id) === selected);

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) {
          setRoleId(null);
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={t("team.close")} className="gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("team.roleDialog.title", { name: member?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{selectedRole?.description || t("team.roleHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label id="change-role-label" htmlFor="change-role" className="text-sm font-medium">
            {t("team.role")}
          </label>
          <Select
            items={items}
            value={selected}
            onValueChange={(value) => {
              if (typeof value === "string") setRoleId(value);
            }}
          >
            <SelectTrigger
              id="change-role"
              aria-labelledby="change-role-label"
              className="bg-background h-11 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="-mx-5 -mb-5 p-5">
          <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
            {t("team.cancel")}
          </DialogClose>
          <Button
            type="button"
            size="touch"
            disabled={!member || !selectedRole || selectedRole.id === member.roleId}
            onClick={() => {
              if (member && selectedRole) {
                onSave(member, { id: selectedRole.id, name: selectedRole.name });
              }
              setRoleId(null);
            }}
          >
            {t("team.roleDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** A yes-or-cancel question about one person, for changes that sign them out or lock them. */
const ConfirmDialog = ({
  member,
  onClose,
  title,
  body,
  confirm,
  variant = "destructive",
  onConfirm,
  children,
}: DialogProps & {
  title: string;
  body: ReactNode;
  confirm: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  children?: ReactNode;
}) => {
  const t = useTranslations("Admin.team");

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("close")} className="gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="-mx-5 -mb-5 p-5">
          <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
            {t("cancel")}
          </DialogClose>
          <Button type="button" size="touch" variant={variant} onClick={onConfirm}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Asks before removing someone's access, since it signs them out straight away. */
export const RemoveAccessDialog = ({
  member,
  onClose,
  onConfirm,
}: DialogProps & { onConfirm: (member: AdminTeamRow) => void }) => {
  const t = useTranslations("Admin.team");
  const name = member?.name ?? "";
  return (
    <ConfirmDialog
      member={member}
      onClose={onClose}
      title={t("removeDialog.title", { name })}
      body={t("removeDialog.body", { name })}
      confirm={t("removeAccess")}
      onConfirm={() => member && onConfirm(member)}
    />
  );
};

/** Asks before resetting someone's two-step verification, since it signs them out everywhere. */
export const ResetTwoFactorDialog = ({
  member,
  onClose,
  onConfirm,
}: DialogProps & { onConfirm: (member: AdminTeamRow) => void }) => {
  const t = useTranslations("Admin.team");
  const name = member?.name ?? "";
  return (
    <ConfirmDialog
      member={member}
      onClose={onClose}
      title={t("resetDialog.title", { name })}
      body={t("resetDialog.body", { name })}
      confirm={t("resetDialog.confirm")}
      onConfirm={() => member && onConfirm(member)}
    />
  );
};

/** Asks before locking someone out, with an optional reason kept with the lock. */
export const LockDialog = ({
  member,
  onClose,
  onConfirm,
}: DialogProps & { onConfirm: (member: AdminTeamRow, reason: string) => void }) => {
  const t = useTranslations("Admin.team");
  const [reason, setReason] = useState("");
  const name = member?.name ?? "";
  return (
    <ConfirmDialog
      member={member}
      onClose={() => {
        setReason("");
        onClose();
      }}
      title={t("lockDialog.title", { name })}
      body={t("lockDialog.body", { name })}
      confirm={t("lockDialog.confirm")}
      onConfirm={() => {
        if (member) onConfirm(member, reason.trim());
        setReason("");
      }}
    >
      <TextField
        id="lock-reason"
        label={t("lockDialog.reason")}
        hint={t("lockDialog.reasonHint")}
        maxLength={300}
        autoComplete="off"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
};

/** Asks before unlocking, showing when and why the account was locked. */
export const UnlockDialog = ({
  member,
  onClose,
  onConfirm,
}: DialogProps & { onConfirm: (member: AdminTeamRow) => void }) => {
  const t = useTranslations("Admin.team");
  const format = useFormatter();
  const name = member?.name ?? "";
  return (
    <ConfirmDialog
      member={member}
      onClose={onClose}
      variant="default"
      title={t("unlockDialog.title", { name })}
      body={t("unlockDialog.body", { name })}
      confirm={t("unlockDialog.confirm")}
      onConfirm={() => member && onConfirm(member)}
    >
      {member?.lockedAt && (
        <div className="bg-muted flex flex-col gap-1 rounded-lg p-3 text-sm">
          <p>
            {t("unlockDialog.lockedSince", {
              date: format.dateTime(member.lockedAt, { dateStyle: "medium", timeStyle: "short" }),
            })}
          </p>
          {member.lockReason && (
            <p className="text-muted-foreground">
              {t("unlockDialog.reason", { reason: member.lockReason })}
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
};

/** Asks before ending all of someone's sessions. */
export const SignOutDialog = ({
  member,
  onClose,
  onConfirm,
}: DialogProps & { onConfirm: (member: AdminTeamRow) => void }) => {
  const t = useTranslations("Admin.team");
  const name = member?.name ?? "";
  return (
    <ConfirmDialog
      member={member}
      onClose={onClose}
      title={t("signOutDialog.title", { name })}
      body={t("signOutDialog.body", { name })}
      confirm={t("signOutDialog.confirm")}
      onConfirm={() => member && onConfirm(member)}
    />
  );
};

/** The role the SuperAdmin takes on handing over, unless they pick another. */
const DEFAULT_HAND_OVER_ROLE = "identity-manager";

/**
 * Hands SuperAdmin to someone else. There's one at a time, so the person handing over picks
 * their own new role and confirms with their password. A refusal stays in the dialog.
 */
export const HandOverSuperAdminDialog = ({
  member,
  roles,
  onClose,
  onDone,
}: DialogProps & {
  /** Every role but SuperAdmin. */
  roles: AdminRoleRow[];
  onDone: (member: AdminTeamRow, role: string) => void;
}) => {
  const t = useTranslations("Admin.team");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<TeamError | "unknown" | null>(null);
  const [isPending, startTransition] = useTransition();
  const fallback = roles.find((role) => role.slug === DEFAULT_HAND_OVER_ROLE) ?? roles[0];
  const selected = roleId ?? (fallback ? String(fallback.id) : "");
  const selectedRole = roles.find((role) => String(role.id) === selected);
  const items = roles.map((role) => ({ value: String(role.id), label: role.name }));
  const name = member?.name ?? "";

  const reset = () => {
    setRoleId(null);
    setPassword("");
    setError(null);
  };

  const submit = () => {
    if (!member || !selectedRole || !password) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await handOverSuperAdmin(member.id, selectedRole.id, password);
        if (result.ok) {
          reset();
          onDone(member, selectedRole.name);
        } else {
          setError(result.error);
        }
      } catch {
        setError("unknown");
      }
    });
  };

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={t("close")} className="gap-5 p-5 sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {t("handOverDialog.title", { name })}
            </DialogTitle>
            <DialogDescription>{t("handOverDialog.body", { name })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label
              id="hand-over-role-label"
              htmlFor="hand-over-role"
              className="text-sm font-medium"
            >
              {t("handOverDialog.yourRole")}
            </label>
            <Select
              items={items}
              value={selected}
              onValueChange={(value) => {
                if (typeof value === "string") setRoleId(value);
              }}
            >
              <SelectTrigger
                id="hand-over-role"
                aria-labelledby="hand-over-role-label"
                aria-describedby="hand-over-role-hint"
                className="bg-background h-11 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="hand-over-role-hint" className="text-muted-foreground text-xs">
              {selectedRole?.description || t("handOverDialog.yourRoleHint")}
            </p>
          </div>
          <PasswordField
            id="hand-over-password"
            label={t("handOverDialog.password")}
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-destructive inline-flex items-center gap-2 text-sm">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {t(`errors.${error}`)}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose
              render={<Button type="button" variant="outline" size="touch" disabled={isPending} />}
            >
              {t("cancel")}
            </DialogClose>
            <Button type="submit" size="touch" disabled={isPending || !password || !selectedRole}>
              {t("handOverDialog.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
