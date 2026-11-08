"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

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
import { ADMIN_ROLES, type AdminRole, isAdminRole } from "@/lib/admin/permissions";
import type { AdminTeamRow } from "@/lib/admin/team-queries";

type DialogProps = {
  member: AdminTeamRow | null;
  onClose: () => void;
};

/** Picks a new role for someone; the change saves when they press Save. */
export const ChangeRoleDialog = ({
  member,
  onClose,
  onSave,
}: DialogProps & { onSave: (member: AdminTeamRow, role: AdminRole) => void }) => {
  const t = useTranslations("Admin");
  const [role, setRole] = useState<AdminRole | null>(null);
  const items = ADMIN_ROLES.map((value) => ({ value, label: t(`roles.${value}.name`) }));
  const selected = role ?? member?.role ?? "viewer";

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) {
          setRole(null);
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={t("team.close")} className="gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("team.roleDialog.title", { name: member?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t(`roles.${selected}.description`)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label id="change-role-label" htmlFor="change-role" className="text-sm font-medium">
            {t("team.role")}
          </label>
          <Select
            items={items}
            value={selected}
            onValueChange={(value) => {
              if (isAdminRole(value)) setRole(value);
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
            disabled={!member || selected === member.role}
            onClick={() => {
              if (member) onSave(member, selected);
              setRole(null);
            }}
          >
            {t("team.roleDialog.save")}
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

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("close")} className="gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("removeDialog.title", { name: member?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {t("removeDialog.body", { name: member?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 p-5">
          <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
            {t("cancel")}
          </DialogClose>
          <Button
            type="button"
            size="touch"
            variant="destructive"
            onClick={() => member && onConfirm(member)}
          >
            {t("removeAccess")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
