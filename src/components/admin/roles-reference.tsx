import { Check, Minus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ADMIN_PERMISSIONS, ADMIN_ROLES, can } from "@/lib/admin/permissions";

/** A permission-by-role grid, generated from `ROLE_PERMISSIONS` so it can't drift from the code. */
export const RolesReference = async () => {
  const t = await getTranslations("Admin");

  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-4">
      <div className="max-w-2xl">
        <h2 id="roles-heading" className="sr-only">
          {t("team.rolesHeading")}
        </h2>
        <p className="text-muted-foreground">{t("team.rolesLead")}</p>
      </div>
      <div className="bg-card ring-foreground/10 overflow-x-auto rounded-xl ring-1">
        <table className="w-full min-w-xl text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-4 py-3 text-left font-medium">
                {t("team.permissionColumn")}
              </th>
              {ADMIN_ROLES.map((role) => (
                <th key={role} scope="col" className="px-4 py-3 text-center font-medium">
                  {t(`roles.${role}.name`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ADMIN_PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-b last:border-b-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  {t(`permissions.${permission}`)}
                </th>
                {ADMIN_ROLES.map((role) => (
                  <td key={role} className="px-4 py-2.5 text-center">
                    {can(role, permission) ? (
                      <Check aria-hidden="true" className="text-primary inline size-4" />
                    ) : (
                      <Minus
                        aria-hidden="true"
                        className="text-muted-foreground/50 inline size-4"
                      />
                    )}
                    <span className="sr-only">
                      {can(role, permission) ? t("team.granted") : t("team.notGranted")}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
