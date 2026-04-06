-- AlterTable
ALTER TABLE "components" ADD COLUMN     "folder_id" TEXT;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
