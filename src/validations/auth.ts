import { z } from "zod";

const passwordRules = z
  .string()
  .min(8, "Fjalëkalimi duhet të ketë së paku 8 karaktere.")
  .max(72, "Fjalëkalimi është shumë i gjatë.") // bcrypt truncates beyond 72 bytes
  .regex(/[a-z]/, "Duhet të përmbajë së paku një shkronjë të vogël.")
  .regex(/[A-Z]/, "Duhet të përmbajë së paku një shkronjë të madhe.")
  .regex(/[0-9]/, "Duhet të përmbajë së paku një numër.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email-i është i detyrueshëm.")
  .email("Adresa e email-it nuk është e vlefshme.")
  .max(254);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Emri i përdoruesit duhet të ketë së paku 3 karaktere.")
  .max(24, "Emri i përdoruesit nuk mund të kalojë 24 karaktere.")
  .regex(
    /^[a-z0-9_]+$/,
    "Lejohen vetëm shkronja të vogla, numra dhe nënvijë (_)."
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Fjalëkalimi është i detyrueshëm.").max(72),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Emri duhet të ketë së paku 2 karaktere.")
      .max(80, "Emri nuk mund të kalojë 80 karaktere."),
    username: usernameSchema,
    email: emailSchema,
    password: passwordRules,
    confirmPassword: z.string(),
    municipalityId: z.string().cuid("Zgjidhni një komunë të vlefshme.").optional().or(z.literal("")),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Duhet të pranoni kushtet e përdorimit." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Fjalëkalimet nuk përputhen.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Emri duhet të ketë së paku 2 karaktere.").max(80),
  bio: z.string().trim().max(500, "Bio nuk mund të kalojë 500 karaktere.").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^(\+383|0)?[1-9][0-9]{7,9}$/, "Numri i telefonit nuk është i vlefshëm.")
    .optional()
    .or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  municipalityId: z.string().cuid().optional().or(z.literal("")),
  avatarUrl: z.string().url().max(1000).optional().or(z.literal("")),
  isPublic: z.boolean().default(true),
});

export const notificationPreferencesSchema = z.object({
  notifyByEmail: z.boolean(),
  notifyInApp: z.boolean(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Shkruani fjalëkalimin aktual.").max(72),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Fjalëkalimet nuk përputhen.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Fjalëkalimi i ri duhet të jetë i ndryshëm nga aktuali.",
    path: ["newPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
