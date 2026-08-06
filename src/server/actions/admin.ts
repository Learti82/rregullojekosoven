"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import {
  banUserSchema,
  categorySchema,
  municipalitySchema,
  updateUserRoleSchema,
} from "@/validations/admin";
import { logActivity, ok, parseInput, toActionError } from "@/server/action-helpers";
import type { ActionResult } from "@/types";

export async function upsertMunicipalityAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireRole("ADMIN");

    const id = (formData.get("id") as string) || undefined;
    const parsed = parseInput(municipalitySchema, {
      id,
      name: formData.get("name"),
      region: formData.get("region"),
      population: formData.get("population") || undefined,
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      email: formData.get("email") ?? "",
      phone: formData.get("phone") ?? "",
      website: formData.get("website") ?? "",
      isActive: formData.get("isActive") !== "false",
    });
    if (!parsed.ok) return parsed.result;

    const { name, region, population, latitude, longitude, email, phone, website, isActive } =
      parsed.data;

    const data = {
      name,
      slug: slugify(name),
      region,
      population: population ?? null,
      latitude,
      longitude,
      email: email || null,
      phone: phone || null,
      website: website || null,
      isActive,
    };

    const municipality = id
      ? await prisma.municipality.update({ where: { id }, data, select: { id: true } })
      : await prisma.municipality.create({ data, select: { id: true } });

    await logActivity({
      userId: admin.id,
      action: id ? "municipality.update" : "municipality.create",
      entityType: "municipality",
      entityId: municipality.id,
    });

    revalidateTag("municipalities");
    revalidatePath("/admin/municipalities");
    return ok({ id: municipality.id }, id ? "Komuna u përditësua." : "Komuna u krijua.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function upsertCategoryAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireRole("ADMIN");

    const id = (formData.get("id") as string) || undefined;
    const parsed = parseInput(categorySchema, {
      id,
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      icon: formData.get("icon") || "alert-triangle",
      color: formData.get("color") || "#2563eb",
      sortOrder: formData.get("sortOrder") || 0,
      isActive: formData.get("isActive") !== "false",
    });
    if (!parsed.ok) return parsed.result;

    const { name, description, icon, color, sortOrder, isActive } = parsed.data;
    const data = {
      name,
      slug: slugify(name),
      description: description || null,
      icon,
      color,
      sortOrder,
      isActive,
    };

    const category = id
      ? await prisma.category.update({ where: { id }, data, select: { id: true } })
      : await prisma.category.create({ data, select: { id: true } });

    await logActivity({
      userId: admin.id,
      action: id ? "category.update" : "category.create",
      entityType: "category",
      entityId: category.id,
    });

    revalidateTag("categories");
    revalidatePath("/admin/categories");
    return ok({ id: category.id }, id ? "Kategoria u përditësua." : "Kategoria u krijua.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireRole("ADMIN");

    // Categories with history are deactivated rather than deleted, so existing
    // reports keep a valid reference.
    const usage = await prisma.report.count({ where: { categoryId: id } });
    if (usage > 0) {
      await prisma.category.update({ where: { id }, data: { isActive: false } });
      revalidateTag("categories");
      revalidatePath("/admin/categories");
      return ok(undefined, "Kategoria ka raporte ekzistuese, prandaj u çaktivizua.");
    }

    await prisma.category.delete({ where: { id } });
    await logActivity({
      userId: admin.id,
      action: "category.delete",
      entityType: "category",
      entityId: id,
    });

    revalidateTag("categories");
    revalidatePath("/admin/categories");
    return ok(undefined, "Kategoria u fshi.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateUserRoleAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireRole("ADMIN");

    const parsed = parseInput(updateUserRoleSchema, {
      userId: formData.get("userId"),
      role: formData.get("role"),
      municipalityId: formData.get("municipalityId") ?? "",
    });
    if (!parsed.ok) return parsed.result;

    const { userId, role, municipalityId } = parsed.data;

    if (userId === admin.id) {
      return { success: false, error: "Nuk mund të ndryshoni rolin tuaj." };
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) return { success: false, error: "Roli nuk ekziston." };

    await prisma.user.update({
      where: { id: userId },
      data: {
        roleId: roleRecord.id,
        // Only municipal roles stay bound to a municipality.
        municipalityId:
          role === "MUNICIPALITY_EMPLOYEE" || role === "MUNICIPALITY_ADMIN"
            ? municipalityId || null
            : null,
      },
    });

    await logActivity({
      userId: admin.id,
      action: "user.role_change",
      entityType: "user",
      entityId: userId,
      metadata: { role, municipalityId: municipalityId || null },
    });

    revalidatePath("/admin/users");
    return ok(undefined, "Roli u përditësua.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function setUserBanAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireRole("ADMIN");

    const parsed = parseInput(banUserSchema, {
      userId: formData.get("userId"),
      isBanned: formData.get("isBanned") === "true",
      reason: formData.get("reason") ?? "",
    });
    if (!parsed.ok) return parsed.result;

    const { userId, isBanned, reason } = parsed.data;
    if (userId === admin.id) {
      return { success: false, error: "Nuk mund të bllokoni veten." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned,
        bannedReason: isBanned ? reason || null : null,
        // Dropping sessions forces an immediate sign-out everywhere.
        sessions: isBanned ? { deleteMany: {} } : undefined,
      },
    });

    await logActivity({
      userId: admin.id,
      action: isBanned ? "user.ban" : "user.unban",
      entityType: "user",
      entityId: userId,
      metadata: { reason: reason || null },
    });

    revalidatePath("/admin/users");
    return ok(undefined, isBanned ? "Përdoruesi u bllokua." : "Bllokimi u hoq.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function adminDeleteReportAction(reportId: string): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireRole("ADMIN");

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, slug: true, createdById: true },
    });
    if (!report) return { success: false, error: "Raporti nuk u gjet." };

    await prisma.$transaction([
      prisma.report.delete({ where: { id: reportId } }),
      prisma.profile.updateMany({
        where: { userId: report.createdById },
        data: { reportsCount: { decrement: 1 } },
      }),
    ]);

    await logActivity({
      userId: admin.id,
      action: "report.admin_delete",
      entityType: "report",
      entityId: reportId,
    });

    revalidatePath("/admin/reports");
    revalidatePath("/explore");
    return ok(undefined, "Raporti u fshi.");
  } catch (error) {
    return toActionError(error);
  }
}
