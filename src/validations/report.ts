import { z } from "zod";
import { KOSOVO_BOUNDS, MAX_IMAGES_PER_REPORT, MAX_IMAGE_SIZE_BYTES, ACCEPTED_IMAGE_TYPES } from "@/lib/constants";

const latitude = z
  .number()
  .min(KOSOVO_BOUNDS.minLat, "Vendndodhja duhet të jetë brenda Kosovës.")
  .max(KOSOVO_BOUNDS.maxLat, "Vendndodhja duhet të jetë brenda Kosovës.");

const longitude = z
  .number()
  .min(KOSOVO_BOUNDS.minLng, "Vendndodhja duhet të jetë brenda Kosovës.")
  .max(KOSOVO_BOUNDS.maxLng, "Vendndodhja duhet të jetë brenda Kosovës.");

export const reportImageSchema = z.object({
  url: z.string().url("URL e imazhit nuk është e vlefshme.").max(1000),
  key: z.string().min(1).max(500),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
  mimeType: z.enum(ACCEPTED_IMAGE_TYPES),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  caption: z.string().trim().max(255).optional().or(z.literal("")),
});

export const createReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Titulli duhet të ketë së paku 10 karaktere.")
    .max(160, "Titulli nuk mund të kalojë 160 karaktere."),
  description: z
    .string()
    .trim()
    .min(20, "Përshkrimi duhet të ketë së paku 20 karaktere.")
    .max(5000, "Përshkrimi nuk mund të kalojë 5000 karaktere."),
  categoryId: z.string().cuid("Zgjidhni një kategori."),
  municipalityId: z.string().cuid("Zgjidhni komunën."),
  latitude,
  longitude,
  address: z.string().trim().max(255).optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  isAnonymous: z.boolean().default(false),
  images: z
    .array(reportImageSchema)
    .max(MAX_IMAGES_PER_REPORT, `Maksimumi ${MAX_IMAGES_PER_REPORT} imazhe për raport.`)
    .default([]),
});

export const updateReportSchema = createReportSchema
  .pick({ title: true, description: true, categoryId: true, address: true, priority: true })
  .extend({ id: z.string().cuid() });

export const updateStatusSchema = z.object({
  reportId: z.string().cuid(),
  status: z.enum([
    "PENDING",
    "VERIFIED",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "REJECTED",
    "DUPLICATE",
  ]),
  note: z.string().trim().max(1000, "Shënimi nuk mund të kalojë 1000 karaktere.").optional().or(z.literal("")),
  /** Required when marking a report as DUPLICATE. */
  duplicateOfId: z.string().cuid().optional().or(z.literal("")),
  /** Proof images attached when moving to IN_PROGRESS/COMPLETED. */
  images: z.array(reportImageSchema).max(MAX_IMAGES_PER_REPORT).default([]),
}).superRefine((data, ctx) => {
  if (data.status === "REJECTED" && !data.note) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "Arsyeja e refuzimit është e detyrueshme.",
    });
  }
  if (data.status === "DUPLICATE" && !data.duplicateOfId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["duplicateOfId"],
      message: "Zgjidhni raportin origjinal.",
    });
  }
});

export const assignReportSchema = z.object({
  reportId: z.string().cuid(),
  assigneeId: z.string().cuid("Zgjidhni një punonjës."),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  dueAt: z.coerce.date().min(new Date(Date.now() - 60_000), "Afati duhet të jetë në të ardhmen.").optional(),
});

export const internalNoteSchema = z.object({
  reportId: z.string().cuid(),
  body: z
    .string()
    .trim()
    .min(2, "Shënimi është shumë i shkurtër.")
    .max(2000, "Shënimi nuk mund të kalojë 2000 karaktere."),
});

export const voteSchema = z.object({
  reportId: z.string().cuid(),
  type: z.enum(["UPVOTE", "DOWNVOTE"]).default("UPVOTE"),
});

export const commentSchema = z.object({
  reportId: z.string().cuid(),
  parentId: z.string().cuid().optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(2, "Komenti është shumë i shkurtër.")
    .max(2000, "Komenti nuk mund të kalojë 2000 karaktere."),
});

export const reportFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  municipality: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  status: z
    .enum(["PENDING", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "REJECTED", "DUPLICATE"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  range: z.enum(["all", "24h", "7d", "30d", "year"]).default("all"),
  sort: z.enum(["recent", "popular", "discussed", "oldest"]).default("recent"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const presignSchema = z.object({
  contentType: z.enum(ACCEPTED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
  prefix: z.enum(["reports", "progress", "avatars"]).default("reports"),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AssignReportInput = z.infer<typeof assignReportSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type ReportImageInput = z.infer<typeof reportImageSchema>;
export type PresignInput = z.infer<typeof presignSchema>;
