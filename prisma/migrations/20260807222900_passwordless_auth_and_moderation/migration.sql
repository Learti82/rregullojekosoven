/*
  Warnings:

  - You are about to drop the column `password_hash` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderated_by" TEXT,
ADD COLUMN     "moderation_note" VARCHAR(500),
ADD COLUMN     "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- Backfill: reports that already existed were public before this migration, and
-- the new default would retroactively unpublish every one of them. The approval
-- gate applies to submissions made from here on, not to the existing record.
UPDATE "reports" SET "moderation_status" = 'APPROVED', "moderated_at" = "created_at";

-- AlterTable
-- Sign-in is passwordless (emailed one-time codes), so no code path reads or
-- writes this column any more.
ALTER TABLE "users" DROP COLUMN "password_hash";

-- CreateTable
CREATE TABLE "login_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" VARCHAR(20) NOT NULL DEFAULT 'SIGN_IN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_codes_email_expires_at_idx" ON "login_codes"("email", "expires_at");

-- CreateIndex
CREATE INDEX "login_codes_expires_at_idx" ON "login_codes"("expires_at");

-- CreateIndex
CREATE INDEX "reports_moderation_status_created_at_idx" ON "reports"("moderation_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_moderation_status_status_created_at_idx" ON "reports"("moderation_status", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_moderation_status_municipality_id_created_at_idx" ON "reports"("moderation_status", "municipality_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_moderation_status_score_idx" ON "reports"("moderation_status", "score" DESC);

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
