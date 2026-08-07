import { z } from "zod";

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

/** Step 1 of sign-in: ask for a code. */
export const requestCodeSchema = z.object({
  email: emailSchema,
});

/** Step 2: submit the emailed code. Spaces and dashes are tolerated. */
export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(
      z
        .string()
        .length(6, "Kodi duhet të ketë 6 shifra.")
        .regex(/^[0-9]{6}$/, "Kodi përmban vetëm shifra.")
    ),
});

/** Used by the Auth.js credentials provider, which re-verifies server-side. */
export const loginSchema = z.object({
  email: emailSchema,
  code: z.string().min(6).max(12),
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
    municipalityId: z.string().cuid("Zgjidhni një komunë të vlefshme.").optional().or(z.literal("")),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Duhet të pranoni kushtet e përdorimit." }),
    }),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
