import { z } from "zod";

export const municipalitySchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, "Emri është i detyrueshëm.").max(80),
  region: z.string().trim().min(2, "Rajoni është i detyrueshëm.").max(80),
  population: z.coerce.number().int().min(0).max(5_000_000).optional(),
  latitude: z.coerce.number().min(41.85).max(43.28),
  longitude: z.coerce.number().min(20).max(21.8),
  email: z.string().email("Email-i nuk është i vlefshëm.").optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  website: z.string().url("URL nuk është e vlefshme.").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const categorySchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, "Emri është i detyrueshëm.").max(60),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  icon: z.string().trim().min(1).max(50).default("alert-triangle"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Ngjyra duhet të jetë në format HEX (p.sh. #2563eb)."),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["CITIZEN", "MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN"]),
  municipalityId: z.string().cuid().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  const needsMunicipality =
    data.role === "MUNICIPALITY_EMPLOYEE" || data.role === "MUNICIPALITY_ADMIN";
  if (needsMunicipality && !data.municipalityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["municipalityId"],
      message: "Punonjësit komunalë duhet të lidhen me një komunë.",
    });
  }
});

export const banUserSchema = z.object({
  userId: z.string().cuid(),
  isBanned: z.boolean(),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.isBanned && !data.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Arsyeja e bllokimit është e detyrueshme.",
    });
  }
});

export const adminUserFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["CITIZEN", "MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN", "ADMIN"]).optional(),
  municipality: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type MunicipalityInput = z.infer<typeof municipalitySchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
