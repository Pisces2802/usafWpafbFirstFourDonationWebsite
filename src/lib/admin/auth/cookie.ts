/**
 * The back-office session cookie. `__Host-` pins it to this host over HTTPS with path `/`;
 * browsers only accept that prefix on secure origins, so local development uses a plain name.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-ff-admin" : "ff-admin";

/** Back-office pages that work without a session. Everything else under `/admin` needs one. */
export const PUBLIC_ADMIN_PATHS = [
  "/admin/sign-in",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/verify-email",
  "/admin/two-factor",
] as const;

export const isPublicAdminPath = (pathname: string) =>
  PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Where to go after signing in. Only back-office paths are allowed, so a crafted `?next=` can't
 * send someone to another site.
 */
export const safeNextPath = (next: unknown) => {
  if (typeof next !== "string") return "/admin";
  if (!/^\/admin(?:[/?#]|$)/.test(next) || next.includes("\\") || isPublicAdminPath(next)) {
    return "/admin";
  }
  return next;
};
