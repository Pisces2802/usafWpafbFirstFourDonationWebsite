import { Sidebar } from "@/components/admin/sidebar";
import { adminNav } from "@/config/admin-navigation";
import { getAdminUser } from "@/lib/admin/access";
import { can } from "@/lib/admin/permissions";

/** The sidebar, limited to what the current user's role can open. */
export const AdminNav = async () => {
  const user = await getAdminUser();
  const keys = user
    ? adminNav.filter((item) => !item.permission || can(user.role, item.permission))
    : [];
  return <Sidebar keys={keys.map((item) => item.key)} />;
};
