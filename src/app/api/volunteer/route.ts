import { createFormRoute } from "@/lib/form-route";
import { volunteerSchema } from "@/lib/form-schemas";
import { notifyVolunteer, saveVolunteer } from "@/lib/form-submissions";

export const POST = createFormRoute("volunteer", volunteerSchema, {
  save: saveVolunteer,
  notify: notifyVolunteer,
});
