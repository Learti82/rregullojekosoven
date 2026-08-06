import type { RoleName } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  canManageReport,
  isAdmin,
  isMunicipalityStaff,
  type Actor,
} from "@/lib/authorization";

/**
 * Session-bound authorization guards.
 *
 * These resolve the current session and then delegate the actual decision to
 * the pure policy in `authorization.ts`. Keeping the two apart means the rules
 * can be unit-tested without booting Auth.js.
 */

export type SessionUser = Actor & {
  name: string;
  email: string;
  image?: string | null;
  username: string;
};

// Re-exported so call sites have a single import for authorization concerns.
export {
  canManageReport,
  canEditReport,
  canDeleteComment,
  isAdmin,
  isMunicipalityStaff,
  isStaffOrAdmin,
} from "@/lib/authorization";

/** Thrown by the guards below; server actions translate it into a form error. */
export class AuthorizationError extends Error {
  constructor(message = "Nuk keni leje për këtë veprim.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image,
    role: (session.user.role ?? "CITIZEN") as RoleName,
    username: session.user.username ?? "",
    municipalityId: session.user.municipalityId ?? null,
  };
}

/** Requires any authenticated user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Duhet të kyçeni për të vazhduar.");
  return user;
}

export async function requireRole(...roles: RoleName[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export async function requireReportManager(report: { municipalityId: string }) {
  const user = await requireUser();
  if (!canManageReport(user, report)) throw new AuthorizationError();
  return user;
}

export async function requireMunicipalityScope(): Promise<
  SessionUser & { scopedMunicipalityId: string | null }
> {
  const user = await requireRole("MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN");
  if (isMunicipalityStaff(user) && !user.municipalityId) {
    throw new AuthorizationError("Llogaria juaj nuk është e lidhur me asnjë komunë.");
  }
  return {
    ...user,
    // Admins see everything, staff are pinned to their own municipality.
    scopedMunicipalityId: isAdmin(user) ? null : user.municipalityId,
  };
}
