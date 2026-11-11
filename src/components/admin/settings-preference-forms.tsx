"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Controller } from "react-hook-form";

import { AuthAlert, AuthNotice } from "@/components/admin/auth/auth-parts";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuthForm } from "@/hooks/use-auth-form";
import {
  updateNotifications,
  updatePlatformSettings,
  updatePreferences,
} from "@/lib/admin/settings-actions";
import {
  type NotificationValues,
  notificationsSchema,
  PAGE_SIZES,
  platformSettingsSchema,
  preferencesSchema,
  SESSION_HOURS,
} from "@/lib/admin/settings-schema";

/** Settings wording for a refusal where there is one, otherwise the shared auth wording. */
const useErrorText = () => {
  const t = useTranslations("Admin");
  return (key: string | null | undefined) => {
    if (!key) return undefined;
    const own = `settings.errors.${key}` as Parameters<typeof t>[0];
    return t(t.has(own) ? own : (`auth.errors.${key}` as Parameters<typeof t>[0]));
  };
};

type SwitchRowProps = {
  id: string;
  label: ReactNode;
  hint: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** A setting that's on or off: its name and what it does, with the switch beside them. */
const SwitchRow = ({ id, label, hint, checked, onCheckedChange }: SwitchRowProps) => (
  <div className="flex items-start justify-between gap-6 border-b py-4 first:pt-0 last:border-b-0">
    <div className="flex flex-col gap-1">
      <span id={`${id}-label`} className="font-medium">
        {label}
      </span>
      <span id={`${id}-hint`} className="text-muted-foreground text-sm">
        {hint}
      </span>
    </div>
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      className="mt-1"
    />
  </div>
);

type ChoiceFieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
};

/** A labelled shadcn Select for one setting. */
const ChoiceField = ({ id, label, hint, value, onValueChange, items }: ChoiceFieldProps) => (
  <div className="flex flex-col gap-2">
    <label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    {hint && (
      <p id={`${id}-hint`} className="text-muted-foreground -mt-1 text-sm">
        {hint}
      </p>
    )}
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="bg-background h-11 w-full max-w-md"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/** Save button with a "Saved" note once the server has accepted the change. */
const SaveRow = ({ isSubmitting, isSaved }: { isSubmitting: boolean; isSaved: boolean }) => {
  const t = useTranslations("Admin.settings");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="touch" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? t("saving") : t("save")}
      </Button>
      {isSaved && !isSubmitting && <AuthNotice>{t("saved")}</AuthNotice>}
    </div>
  );
};

type NotificationsFormProps = {
  values: NotificationValues;
  /** Topics this person's role can see; the others aren't offered. */
  canSee: { volunteers: boolean; messages: boolean };
  /** False until Resend is set up, so nothing can be sent yet. */
  canEmail: boolean;
};

export const NotificationsForm = ({ values, canSee, canEmail }: NotificationsFormProps) => {
  const t = useTranslations("Admin.settings.notifications");
  const errorText = useErrorText();
  const { control, submit, error, isSubmitting, isSubmitSuccessful } = useAuthForm({
    schema: notificationsSchema,
    defaultValues: values,
    action: updateNotifications,
    onSuccess: () => {},
  });

  const rows = [
    canSee.volunteers && ("notifyVolunteers" as const),
    canSee.messages && ("notifyMessages" as const),
    "notifySecurity" as const,
  ].filter((row) => row !== false);

  return (
    <form noValidate onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
      {!canEmail && <AuthAlert>{t("emailOff")}</AuthAlert>}
      <AuthAlert>{errorText(error)}</AuthAlert>
      <div>
        {rows.map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <SwitchRow
                id={`settings-${name}`}
                label={t(`${name}.label`)}
                hint={t(`${name}.hint`)}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        ))}
      </div>
      <SaveRow isSubmitting={isSubmitting} isSaved={isSubmitSuccessful} />
    </form>
  );
};

const SITE_DEFAULT = "site-default";

type PreferencesFormProps = {
  values: { timeZone: string; pageSize: string };
  timeZones: string[];
  siteTimeZone: string;
};

export const PreferencesForm = ({ values, timeZones, siteTimeZone }: PreferencesFormProps) => {
  const t = useTranslations("Admin.settings.preferences");
  const errorText = useErrorText();
  const { control, submit, error, fieldError, isSubmitting, isSubmitSuccessful } = useAuthForm({
    schema: preferencesSchema,
    defaultValues: values,
    action: updatePreferences,
    onSuccess: () => {},
  });

  const zoneLabel = (zone: string) => zone.replaceAll("_", " ").replaceAll("/", " / ");
  const zoneItems = [
    { value: SITE_DEFAULT, label: t("siteDefault", { zone: zoneLabel(siteTimeZone) }) },
    ...timeZones.map((zone) => ({ value: zone, label: zoneLabel(zone) })),
  ];

  return (
    <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-5">
      <AuthAlert>{errorText(error ?? fieldError("timeZone"))}</AuthAlert>
      <Controller
        control={control}
        name="timeZone"
        render={({ field }) => (
          <ChoiceField
            id="settings-time-zone"
            label={t("timeZone")}
            hint={t("timeZoneHint")}
            value={field.value || SITE_DEFAULT}
            onValueChange={(value) => field.onChange(value === SITE_DEFAULT ? "" : value)}
            items={zoneItems}
          />
        )}
      />
      <Controller
        control={control}
        name="pageSize"
        render={({ field }) => (
          <ChoiceField
            id="settings-page-size"
            label={t("pageSize")}
            hint={t("pageSizeHint")}
            value={field.value}
            onValueChange={field.onChange}
            items={PAGE_SIZES.map((size) => ({ value: size, label: t("rows", { count: +size }) }))}
          />
        )}
      />
      <SaveRow isSubmitting={isSubmitting} isSaved={isSubmitSuccessful} />
    </form>
  );
};

type PlatformFormProps = {
  values: { inboxEmail: string; donationsPaused: boolean; sessionHours: string };
  /** `ORG_NOTIFY_EMAIL`, used when no inbox is set here. */
  fallbackInbox: string | null;
  lastChange: { by: string | null; at: Date } | null;
};

export const PlatformForm = ({ values, fallbackInbox, lastChange }: PlatformFormProps) => {
  const t = useTranslations("Admin.settings.platform");
  const format = useFormatter();
  const errorText = useErrorText();
  const { register, control, submit, error, fieldError, isSubmitting, isSubmitSuccessful } =
    useAuthForm({
      schema: platformSettingsSchema,
      defaultValues: values,
      action: updatePlatformSettings,
      onSuccess: () => {},
    });

  return (
    <form noValidate onSubmit={submit} className="flex max-w-2xl flex-col gap-6">
      <AuthAlert>{errorText(error)}</AuthAlert>
      <TextField
        id="settings-inbox"
        type="email"
        label={t("inbox")}
        hint={fallbackInbox ? t("inboxHintFallback", { email: fallbackInbox }) : t("inboxHintNone")}
        autoComplete="off"
        spellCheck={false}
        className="max-w-md"
        error={errorText(fieldError("inboxEmail"))}
        {...register("inboxEmail")}
      />
      <Controller
        control={control}
        name="donationsPaused"
        render={({ field }) => (
          <SwitchRow
            id="settings-donations-paused"
            label={t("donationsPaused")}
            hint={t("donationsPausedHint")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="sessionHours"
        render={({ field }) => (
          <ChoiceField
            id="settings-session-hours"
            label={t("sessionHours")}
            hint={t("sessionHoursHint")}
            value={field.value}
            onValueChange={field.onChange}
            items={SESSION_HOURS.map((hours) => ({
              value: hours,
              label: t("hours", { count: +hours }),
            }))}
          />
        )}
      />
      <SaveRow isSubmitting={isSubmitting} isSaved={isSubmitSuccessful} />
      {lastChange && (
        <p className="text-muted-foreground text-sm">
          {t("lastChange", {
            name: lastChange.by ?? t("someone"),
            when: format.dateTime(lastChange.at, { dateStyle: "medium", timeStyle: "short" }),
          })}
        </p>
      )}
    </form>
  );
};
