import { getAdminUser } from "@/lib/admin/access";
import { can } from "@/lib/admin/permissions";
import { signStoryImageUpload } from "@/lib/stories/cloudinary";

const error = (status: number, code: string) => Response.json({ error: code }, { status });

/**
 * Signs a direct upload to Cloudinary for an image in a story. The browser sends the file straight
 * there with these fields, so the API secret never leaves the server. Only people who can manage
 * stories get a signature.
 */
export const POST = async () => {
  const user = await getAdminUser();
  if (!user) return error(401, "unauthorized");
  if (!can(user.role, "stories:manage")) return error(403, "forbidden");

  const signed = signStoryImageUpload();
  if (!signed) return error(503, "notConfigured");
  return Response.json(signed, { headers: { "Cache-Control": "private, no-store" } });
};
