"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TextField } from "@/components/donation/text-field";
import { SelectField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type AddedPerson, useAddAdminUserForm } from "@/hooks/use-add-admin-user-form";
import { DEFAULT_ROLE_SLUG } from "@/lib/admin/permissions";
import type { AdminRoleRow } from "@/lib/admin/role-queries";

type AddAdminUserDialogProps = {
  /** The roles this person may give out. */
  roles: AdminRoleRow[];
  onAdded: (added: AddedPerson & { roleName: string }) => void;
};

/** "Add person" button that opens the add-person form in a dialog. */
export const AddAdminUserDialog = ({ roles, onAdded }: AddAdminUserDialogProps) => {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const { register, submit, clear, isSubmitting, fieldError, error } = useAddAdminUserForm({
    defaultRoleId:
      (roles.find((role) => role.slug === DEFAULT_ROLE_SLUG) ?? roles.at(-1))?.id ?? null,
    onAdded: (added) => {
      setOpen(false);
      const role = roles.find((item) => item.id === added.roleId);
      onAdded({ ...added, roleName: role?.name ?? "" });
    },
  });

  const message = (field: Parameters<typeof fieldError>[0]) => {
    const key = fieldError(field);
    return key && t(`team.errors.${key}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) clear();
      }}
    >
      <DialogTrigger render={<Button size="touch" />}>
        <UserPlus aria-hidden="true" />
        {t("team.add")}
      </DialogTrigger>
      <DialogContent closeLabel={t("team.close")} className="gap-5 p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{t("team.addHeading")}</DialogTitle>
          <DialogDescription>{t("team.pendingSignIn")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <TextField
            id="team-name"
            label={t("team.name")}
            autoComplete="off"
            error={message("name")}
            {...register("name")}
          />
          <TextField
            id="team-email"
            type="email"
            label={t("team.email")}
            hint={t("team.emailHint")}
            autoComplete="off"
            spellCheck={false}
            error={message("email")}
            {...register("email")}
          />
          <SelectField
            id="team-role"
            label={t("team.role")}
            hint={t("team.roleHint")}
            error={message("roleId")}
            options={roles.map((role) => ({
              value: String(role.id),
              label: role.description ? `${role.name} – ${role.description}` : role.name,
            }))}
            {...register("roleId")}
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t(`team.errors.${error}`)}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
              {t("team.cancel")}
            </DialogClose>
            <Button type="submit" size="touch" disabled={isSubmitting}>
              {isSubmitting ? t("team.adding") : t("team.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
