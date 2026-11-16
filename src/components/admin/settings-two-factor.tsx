"use client";

import { Mail, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthAlert, AuthNotice, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { PasswordField } from "@/components/admin/auth/password-field";
import { type TwoFactorMethod, TwoFactorSetup } from "@/components/admin/auth/two-factor-setup";
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
import { useAuthForm } from "@/hooks/use-auth-form";
import { confirmPasswordSchema } from "@/lib/admin/auth/schema";
import { turnOffTwoFactor } from "@/lib/admin/auth/two-factor-actions";

type TwoFactorSettingsProps = {
  email: string;
  method: TwoFactorMethod | null;
  /** Their role needs a second step: they can switch methods but not turn it off. */
  required: boolean;
  emailAvailable: boolean;
};

const TurnOffDialog = ({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) => {
  const t = useTranslations("Admin");
  const { register, submit, fieldError, error, isSubmitting, reset } = useAuthForm({
    schema: confirmPasswordSchema,
    defaultValues: { password: "" },
    action: (values) => turnOffTwoFactor(values.password),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const passwordError = fieldError("password");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={t("team.close")} className="gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("settings.twoFactor.turnOffTitle")}
          </DialogTitle>
          <DialogDescription>{t("settings.twoFactor.turnOffBody")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <AuthAlert>{error && t(`auth.errors.${error}`)}</AuthAlert>
          <PasswordField
            id="turn-off-password"
            label={t("auth.currentPassword")}
            autoComplete="current-password"
            error={passwordError && t(`auth.errors.${passwordError}` as Parameters<typeof t>[0])}
            {...register("password")}
          />
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <DialogClose render={<Button type="button" variant="outline" size="touch" />}>
              {t("settings.twoFactor.cancel")}
            </DialogClose>
            <AuthSubmit
              isSubmitting={isSubmitting}
              label={t("settings.twoFactor.turnOffConfirm")}
              submittingLabel={t("auth.twoFactor.submitting")}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * The second step in Settings: what's on now, switching to an app or emailed codes, and turning
 * it off where the role allows. Each change asks for the current password first.
 */
export const TwoFactorSettings = ({
  email,
  method,
  required,
  emailAvailable,
}: TwoFactorSettingsProps) => {
  const t = useTranslations("Admin.settings.twoFactor");
  const router = useRouter();
  const [changing, setChanging] = useState<TwoFactorMethod | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [notice, setNotice] = useState<"changed" | "turnedOff" | null>(null);
  // Starts each opening of the dialog from the first step.
  const [setupKey, setSetupKey] = useState(0);

  const Icon = method ? ShieldCheck : ShieldAlert;
  const options = [
    {
      method: "authenticator" as const,
      icon: Smartphone,
      label: method === "authenticator" ? t("switchAuthenticator") : t("useAuthenticator"),
      shown: true,
    },
    {
      method: "email" as const,
      icon: Mail,
      label: t("useEmail"),
      shown: emailAvailable && method !== "email",
    },
  ].filter((option) => option.shown);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t("lead")}</p>
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <Icon
          aria-hidden="true"
          className={`size-4 shrink-0 ${method ? "text-emerald-600" : "text-taxiway"}`}
        />
        {t(`current.${method ?? "none"}`, { email })}
      </p>
      {required && <p className="text-muted-foreground text-sm">{t("required")}</p>}
      {notice && (
        <div aria-live="polite">
          <AuthNotice>{t(notice)}</AuthNotice>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {options.map(({ method: option, icon: OptionIcon, label }) => (
          <Button
            key={option}
            type="button"
            size="touch"
            variant="outline"
            onClick={() => {
              setNotice(null);
              setSetupKey((key) => key + 1);
              setChanging(option);
            }}
          >
            <OptionIcon aria-hidden="true" />
            {label}
          </Button>
        ))}
        {method && !required && (
          <Button
            type="button"
            size="touch"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setNotice(null);
              setTurningOff(true);
            }}
          >
            {t("turnOff")}
          </Button>
        )}
      </div>

      <Dialog
        open={changing !== null}
        onOpenChange={(open) => {
          if (open) return;
          setChanging(null);
          // Closed partway, perhaps after the change saved: show what's on now.
          router.refresh();
        }}
      >
        <DialogContent closeLabel={t("cancel")} className="gap-5 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          {changing && (
            <TwoFactorSetup
              key={setupKey}
              email={email}
              required={required}
              context="signedIn"
              methods={[changing]}
              method={changing}
              showHeading={false}
              onFinished={() => {
                setChanging(null);
                setNotice("changed");
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <TurnOffDialog
        open={turningOff}
        onOpenChange={setTurningOff}
        onDone={() => {
          setTurningOff(false);
          setNotice("turnedOff");
        }}
      />
    </div>
  );
};
