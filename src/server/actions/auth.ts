"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { requireUser } from "@/lib/permissions";
import { enforceRateLimit, getClientIp, hashIdentifier } from "@/lib/rate-limit";
import { slugify, safeRedirectPath } from "@/lib/utils";
import {
  notificationPreferencesSchema,
  registerSchema,
  requestCodeSchema,
  updateProfileSchema,
  verifyCodeSchema,
} from "@/validations/auth";
import { issueLoginCode, CODE_TTL_MINUTES } from "@/lib/login-code";
import { loginCodeEmail, sendEmail } from "@/lib/email";
import { logActivity, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

/** Generate a free username from the requested one, e.g. `arta` → `arta2`. */
async function ensureUniqueUsername(desired: string): Promise<string> {
  const base = slugify(desired).replace(/-/g, "_").slice(0, 20) || "qytetar";
  let candidate = base;
  for (let attempt = 0; attempt < 50; attempt++) {
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = `${base}${attempt + 2}`;
  }
  return `${base}_${Date.now().toString(36)}`;
}

export async function registerAction(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData
): Promise<ActionResult<{ email: string }>> {
  try {
    await enforceRateLimit("register");

    const parsed = parseInput(registerSchema, {
      name: formData.get("name"),
      username: formData.get("username"),
      email: formData.get("email"),
      municipalityId: formData.get("municipalityId") ?? "",
      acceptTerms: formData.get("acceptTerms") === "on" || formData.get("acceptTerms") === "true",
    });
    if (!parsed.ok) return parsed.result;

    const { name, email, username, municipalityId } = parsed.data;

    const existingEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingEmail) {
      return {
        success: false,
        error: "Ky email është i regjistruar tashmë.",
        fieldErrors: { email: ["Ky email është i regjistruar tashmë."] },
      };
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existingUsername) {
      return {
        success: false,
        error: "Ky emër përdoruesi është i zënë.",
        fieldErrors: { username: ["Ky emër përdoruesi është i zënë."] },
      };
    }

    const citizenRole = await prisma.role.findUnique({ where: { name: "CITIZEN" } });
    if (!citizenRole) {
      return { success: false, error: "Sistemi nuk është i inicializuar. Kontaktoni administratorin." };
    }

    // User + profile are created together so a profile row always exists.
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username: await ensureUniqueUsername(username),
        roleId: citizenRole.id,
        municipalityId: municipalityId || null,
        profile: { create: {} },
      },
      select: { id: true, email: true },
    });

    await logActivity({
      userId: user.id,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
    });

    return ok({ email: user.email }, "Llogaria u krijua. Ju dërguam një kod kyçjeje në email.");
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Step 1 — email a one-time code.
 *
 * Always reports success, whether or not the address has an account. Telling a
 * caller "no such user" turns the login form into a membership oracle: anyone
 * could enumerate which citizens are registered on a platform where people
 * report problems with their own municipality.
 */
export async function requestLoginCodeAction(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData
): Promise<ActionResult<{ email: string }>> {
  try {
    const parsed = parseInput(requestCodeSchema, { email: formData.get("email") });
    if (!parsed.ok) return parsed.result;

    const { email } = parsed.data;
    const ip = await getClientIp();

    // Two axes, as with any credential endpoint: per address (targeted) and
    // per IP (spraying, and abusing us as a mail relay).
    await enforceRateLimit("loginIp", ip);
    await enforceRateLimit("login", `code:${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true, isBanned: true },
    });

    if (user && user.isActive && !user.isBanned) {
      const { code } = await issueLoginCode(email, hashIdentifier(ip));
      const message = loginCodeEmail(code, CODE_TTL_MINUTES);
      const sent = await sendEmail({ to: email, ...message });

      if (!sent.ok) return { success: false, error: sent.error };

      await logActivity({
        userId: user.id,
        action: "auth.code_requested",
        entityType: "user",
        entityId: user.id,
      });
    }

    return ok(
      { email },
      `Nëse ky email ka llogari, kodi u dërgua. Kontrolloni kutinë tuaj (skadon pas ${CODE_TTL_MINUTES} minutash).`
    );
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Step 2 — exchange the code for a session.
 *
 * The code is verified inside the Auth.js provider rather than here, so a
 * single place consumes it and there is no window where it is checked twice.
 */
export async function verifyLoginCodeAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = parseInput(verifyCodeSchema, {
      email: formData.get("email"),
      code: formData.get("code"),
    });
    if (!parsed.ok) return parsed.result;

    await enforceRateLimit("login", `verify:${parsed.data.email}`);

    const redirectTo = safeRedirectPath(formData.get("callbackUrl") as string | null);

    await signIn("credentials", {
      email: parsed.data.email,
      code: parsed.data.code,
      redirect: false,
    });

    return ok({ redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Kodi nuk është i saktë ose ka skaduar. Kërkoni një kod të ri." };
    }
    return toActionError(error);
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export async function updateProfileAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();

    const parsed = parseInput(updateProfileSchema, {
      name: formData.get("name"),
      bio: formData.get("bio") ?? "",
      phone: formData.get("phone") ?? "",
      city: formData.get("city") ?? "",
      municipalityId: formData.get("municipalityId") ?? "",
      avatarUrl: formData.get("avatarUrl") ?? "",
      isPublic: formData.get("isPublic") !== "false",
    });
    if (!parsed.ok) return parsed.result;

    const { name, bio, phone, city, municipalityId, avatarUrl, isPublic } = parsed.data;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          municipalityId: municipalityId || null,
          ...(avatarUrl ? { image: avatarUrl } : {}),
        },
      }),
      prisma.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bio: bio || null,
          phone: phone || null,
          city: city || null,
          avatarUrl: avatarUrl || null,
          isPublic,
        },
        update: {
          bio: bio || null,
          phone: phone || null,
          city: city || null,
          ...(avatarUrl ? { avatarUrl } : {}),
          isPublic,
        },
      }),
    ]);

    await logActivity({
      userId: user.id,
      action: "profile.update",
      entityType: "user",
      entityId: user.id,
    });

    revalidatePath("/settings");
    revalidatePath(`/profile/${user.username}`);
    return ok(undefined, "Profili u përditësua.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateNotificationPreferencesAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = parseInput(notificationPreferencesSchema, {
      notifyByEmail: formData.get("notifyByEmail") === "on" || formData.get("notifyByEmail") === "true",
      notifyInApp: formData.get("notifyInApp") === "on" || formData.get("notifyInApp") === "true",
    });
    if (!parsed.ok) return parsed.result;

    await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: parsed.data,
    });

    revalidatePath("/settings");
    return ok(undefined, "Preferencat u ruajtën.");
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Self-service account deletion.
 * Reports are kept for the public record but detached from the person: the
 * account row is cascaded away and the reports are re-parented to a system
 * "anonymous" user, matching the privacy policy.
 */
export async function deleteAccountAction(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();

    const anonymous = await prisma.user.upsert({
      where: { email: "anonim@rregullokosoven.org" },
      update: {},
      create: {
        email: "anonim@rregullokosoven.org",
        name: "Përdorues i fshirë",
        username: "anonim",
        isActive: false,
        role: { connect: { name: "CITIZEN" } },
        profile: { create: { isPublic: false } },
      },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.report.updateMany({
        where: { createdById: user.id },
        data: { createdById: anonymous.id, isAnonymous: true },
      }),
      prisma.comment.updateMany({
        where: { userId: user.id },
        data: { isDeleted: true, body: "" },
      }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    await logActivity({ action: "account.delete", entityType: "user", entityId: user.id });
    await signOut({ redirect: false });
    return ok(undefined, "Llogaria u fshi.");
  } catch (error) {
    return toActionError(error);
  }
}
