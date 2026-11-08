import type { routing } from "@/i18n/routing";
import type adminMessages from "../messages/admin/en.json";
import type messages from "../messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages & { Admin: typeof adminMessages };
  }
}
