-- AlterTable
ALTER TABLE "dashboard_filters" ADD COLUMN     "query_id" TEXT;

-- AddForeignKey
ALTER TABLE "dashboard_filters" ADD CONSTRAINT "dashboard_filters_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
