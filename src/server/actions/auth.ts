"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { requireUser } from "@/lib/permissions";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { slugify, safeRedirectPath } from "@/lib/utils";
import {
  changePasswordSchema,
  loginSchema,
  notificationPreferencesSchema,
  registerSchema,
  updateProfileSchema,
} from "@/validations/auth";
import { logActivity, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

const BCRYPT_ROUNDS = 12;

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
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      municipalityId: formData.get("municipalityId") ?? "",
      acceptTerms: formData.get("acceptTerms") === "on" || formData.get("acceptTerms") === "true",
    });
    if (!parsed.ok) return parsed.result;

    const { name, email, password, username, municipalityId } = parsed.data;

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

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // User + profile are created together so a profile row always exists.
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username: await ensureUniqueUsername(username),
        passwordHash,
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

    return ok({ email: user.email }, "Llogaria u krijua me sukses. Tani mund të kyçeni.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function loginAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = parseInput(loginSchema, {
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.ok) return parsed.result;

    // Per-IP first (cheap, catches spraying), then per-account from this IP.
    const ip = await getClientIp();
    await enforceRateLimit("loginIp", ip);
    await enforceRateLimit("login", `${ip}:${parsed.data.email}`);

    const redirectTo = safeRedirectPath(formData.get("callbackUrl") as string | null);

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    return ok({ redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately identical for wrong password and unknown account.
      return { success: false, error: "Email-i ose fjalëkalimi nuk është i saktë." };
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

export async function changePasswordAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("login", `pwchange:${user.id}`);

    const parsed = parseInput(changePasswordSchema, {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.ok) return parsed.result;

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record?.passwordHash) {
      return { success: false, error: "Llogaria juaj nuk përdor fjalëkalim." };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
    if (!valid) {
      return {
        success: false,
        error: "Fjalëkalimi aktual nuk është i saktë.",
        fieldErrors: { currentPassword: ["Fjalëkalimi aktual nuk është i saktë."] },
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
    });

    await logActivity({
      userId: user.id,
      action: "auth.password_change",
      entityType: "user",
      entityId: user.id,
    });

    return ok(undefined, "Fjalëkalimi u ndryshua.");
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
