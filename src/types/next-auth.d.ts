import type { DefaultSession } from "next-auth";

/**
 * Extends the Auth.js session/JWT with the claims the app authorises against.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
      municipalityId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    username?: string;
    municipalityId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    username: string;
    municipalityId: string | null;
  }
}

export {};
