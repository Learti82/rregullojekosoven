import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, isAuthPath, isProtectedPath } from "@/lib/auth.config";

/**
 * Edge middleware.
 *
 * Uses the Prisma-free slice of the Auth.js config (see `auth.config.ts`) so it
 * can run on the Edge runtime. Route handlers and Server Actions re-check
 * authorisation server-side — this is a redirect layer, not the security
 * boundary.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth?.user);
  const role = req.auth?.user?.role;
  const { pathname } = nextUrl;

  // Signed-in users have no business on the login/register screens.
  if (isLoggedIn && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL("/feed", nextUrl));
  }

  if (!isLoggedIn && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/feed", nextUrl));
  }

  if (
    pathname.startsWith("/municipality") &&
    !["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN"].includes(role ?? "")
  ) {
    return NextResponse.redirect(new URL("/feed", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip static assets, image optimisation and the auth API routes.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml|webmanifest)$).*)"],
};
