-- 阶段3 Schema 三改：User.weeklyCapacity + WorkLog.hours/category 必填
-- 生产数据中 hours/category 可能存在 NULL，先回填再收紧约束

-- AlterTable: 增加每周标准工时字段
ALTER TABLE "users" ADD COLUMN "weeklyCapacity" DECIMAL(65,30) NOT NULL DEFAULT 40;

-- Backfill: 历史 NULL 记录回填默认值
UPDATE "work_logs" SET "hours" = 0 WHERE "hours" IS NULL;
UPDATE "work_logs" SET "category" = '其他' WHERE "category" IS NULL;

-- AlterTable: 收紧约束
ALTER TABLE "work_logs" ALTER COLUMN "hours" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL;
