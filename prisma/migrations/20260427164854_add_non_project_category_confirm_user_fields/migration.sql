-- DropForeignKey
ALTER TABLE "work_logs" DROP CONSTRAINT "work_logs_projectId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "work_logs" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "nonProjectCategoryId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "category" DROP NOT NULL;

-- CreateTable
CREATE TABLE "non_project_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "non_project_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "non_project_categories_name_key" ON "non_project_categories"("name");

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_nonProjectCategoryId_fkey" FOREIGN KEY ("nonProjectCategoryId") REFERENCES "non_project_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_project_categories" ADD CONSTRAINT "non_project_categories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
