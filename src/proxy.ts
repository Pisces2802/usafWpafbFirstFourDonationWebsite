import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";
import { isPublicAdminPath, SESSION_COOKIE } from "./lib/admin/auth/cookie";

const handleI18nRouting = createMiddleware(routing);

const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

/**
 * Locale routing for the public site. The back office has no locale, so it skips next-intl.
 * Without a session cookie, back-office pages send people to sign in. That's only a quick first
 * check: the cookie isn't validated here, and every loader, action and route checks the session
 * properly.
 */
const proxy = (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;
  if (!isAdminPath(pathname)) return handleI18nRouting(request);
  if (isPublicAdminPath(pathname) || request.cookies.has(SESSION_COOKIE))
    return NextResponse.next();

  const signIn = new URL("/admin/sign-in", request.url);
  if (pathname !== "/admin") signIn.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signIn);
};

export default proxy;

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
