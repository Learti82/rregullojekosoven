import type { RoleName } from "@prisma/client";

/**
 * Pure authorization policy.
 *
 * Deliberately free of any Auth.js / Prisma / `next/headers` import: these are
 * total functions over plain data, which keeps the rules unit-testable and lets
 * them run in any runtime. The session-bound guards that *apply* this policy
 * live in `permissions.ts`.
 */

export type Actor = {
  id: string;
  role: RoleName;
  municipalityId: string | null;
};

export const isAdmin = (user: Pick<Actor, "role">) => user.role === "ADMIN";

export const isMunicipalityStaff = (user: Pick<Actor, "role">) =>
  user.role === "MUNICIPALITY_EMPLOYEE" || user.role === "MUNICIPALITY_ADMIN";

export const isStaffOrAdmin = (user: Pick<Actor, "role">) =>
  isAdmin(user) || isMunicipalityStaff(user);

/**
 * Municipality staff may only act on reports inside their own municipality.
 * Platform admins are unrestricted.
 */
export function canManageReport(
  user: Pick<Actor, "role" | "municipalityId">,
  report: { municipalityId: string }
): boolean {
  if (isAdmin(user)) return true;
  if (!isMunicipalityStaff(user)) return false;
  return Boolean(user.municipalityId) && user.municipalityId === report.municipalityId;
}

/** Authors may edit their own report only while it is still untouched. */
export function canEditReport(
  user: Pick<Actor, "id" | "role">,
  report: { createdById: string; status: string }
): boolean {
  if (isAdmin(user)) return true;
  return report.createdById === user.id && report.status === "PENDING";
}

export function canDeleteComment(
  user: Pick<Actor, "id" | "role">,
  comment: { userId: string }
): boolean {
  return comment.userId === user.id || isAdmin(user);
}
