import { createFormRoute } from "@/lib/form-route";
import { contactSchema } from "@/lib/form-schemas";
import { notifyContactMessage, saveContactMessage } from "@/lib/form-submissions";

export const POST = createFormRoute("contact", contactSchema, {
  save: saveContactMessage,
  notify: notifyContactMessage,
});
