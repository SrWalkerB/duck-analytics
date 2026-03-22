/*
  Warnings:

  - You are about to drop the column `target_component_ids` on the `dashboard_filters` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "dashboard_filters" DROP COLUMN "target_component_ids",
ADD COLUMN     "target_mappings" JSONB NOT NULL DEFAULT '[]';
