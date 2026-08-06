import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the Auth.js config.
 *
 * `middleware.ts` runs on the Edge runtime, where Prisma and bcrypt cannot be
 * imported. Everything that needs Node lives in `auth.ts`; this file only holds
 * callbacks and route rules that work in both runtimes.
 */

const PROTECTED_PREFIXES = [
  "/reports/new",
  "/notifications",
  "/settings",
  "/municipality",
  "/admin",
] as const;

const AUTH_ROUTES = ["/login", "/register"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/feed",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,
  },
  trustHost: true,
  callbacks: {
    /**
     * Copy the identity claims we authorise against into the JWT so that
     * middleware and server components can check them without a DB round-trip.
     * `trigger === "update"` re-reads them after a profile/role change.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "CITIZEN";
        token.username = (user as { username?: string }).username ?? "";
        token.municipalityId = (user as { municipalityId?: string | null }).municipalityId ?? null;
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name ?? token.name;
        token.picture = session.user.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.municipalityId = (token.municipalityId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      if (isAuthPath(pathname)) return true;
      if (isProtectedPath(pathname)) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
