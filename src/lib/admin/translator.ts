import { createTranslator } from "next-intl";

import adminMessages from "../../../messages/admin/en.json";

/**
 * Back-office strings for server code with no request locale: route handlers, emails and server
 * actions that build text. The back office is English-only.
 */
export const adminTranslator = createTranslator({
  locale: "en",
  messages: { Admin: adminMessages },
  namespace: "Admin",
});
