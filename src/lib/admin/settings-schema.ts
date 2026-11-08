import { z } from "zod";

/** Rows-per-page choices, matching the table footer and the `admin_users_page_size` check. */
export const PAGE_SIZES = ["10", "20", "50", "100"] as const;

/** Sign-in lengths an owner can choose, in hours. */
export const SESSION_HOURS = ["1", "2", "4", "8", "12", "24"] as const;

const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Error messages are keys into `Admin.auth.errors`, like the auth forms. */
export const notificationsSchema = z.object({
  notifyVolunteers: z.boolean(),
  notifyMessages: z.boolean(),
  notifySecurity: z.boolean(),
});
export type NotificationValues = z.infer<typeof notificationsSchema>;

/** An empty time zone means the site default. */
export const preferencesSchema = z.object({
  timeZone: z
    .string()
    .trim()
    .max(64, "timeZone")
    .refine((value) => value === "" || isTimeZone(value), "timeZone"),
  pageSize: z.enum(PAGE_SIZES, "invalid").transform(Number),
});

/** An empty inbox means the `ORG_NOTIFY_EMAIL` fallback. */
export const platformSettingsSchema = z.object({
  inboxEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "email")
    .refine((value) => value === "" || z.email().safeParse(value).success, "email"),
  donationsPaused: z.boolean(),
  sessionHours: z.enum(SESSION_HOURS, "invalid").transform(Number),
});
