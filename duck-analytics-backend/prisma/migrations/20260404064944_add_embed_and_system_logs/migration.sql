-- CreateEnum
CREATE TYPE "DashboardStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "EmbedType" AS ENUM ('PUBLIC', 'JWT_SECURED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "dashboards" ADD COLUMN     "status" "DashboardStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "dashboard_embeds" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "embed_code" TEXT NOT NULL,
    "embed_type" "EmbedType" NOT NULL DEFAULT 'PUBLIC',
    "show_filters" BOOLEAN NOT NULL DEFAULT true,
    "show_title" BOOLEAN NOT NULL DEFAULT true,
    "embed_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_embeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "resource_id" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_embeds_dashboard_id_key" ON "dashboard_embeds"("dashboard_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_embeds_embed_code_key" ON "dashboard_embeds"("embed_code");

-- CreateIndex
CREATE INDEX "system_logs_user_id_source_created_at_idx" ON "system_logs"("user_id", "source", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_resource_id_created_at_idx" ON "system_logs"("resource_id", "created_at");

-- AddForeignKey
ALTER TABLE "dashboard_embeds" ADD CONSTRAINT "dashboard_embeds_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
