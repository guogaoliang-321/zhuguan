/**
 * 审计日志辅助函数
 *
 * 用法：
 *   await writeAudit({
 *     actorId: session.user.id,
 *     action: "user_anonymize",
 *     targetType: "user",
 *     targetId: user.id,
 *     before: { idNumber: oldId, phone: oldPhone },
 *     after: { idNumber: null, phone: null },
 *   });
 *
 * fire-and-forget，绝不影响主路径成败。
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type AuditAction =
  | "user_anonymize"
  | "user_role_change"
  | "user_password_reset"
  | "user_create"
  | "user_deactivate"
  | "project_delete"
  | "task_force_change"
  | "task_delete"
  | "worklog_admin_edit"
  | "worklog_admin_delete"
  | "appeal_resolve"
  | "credentials_setup"
  | "data_purge"
  | "misc";

export interface AuditInput {
  actorId: string;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  meta?: Prisma.InputJsonValue;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        before: input.before,
        after: input.after,
        meta: input.meta,
      },
    });
  } catch {
    // 审计写失败不应阻塞业务，吞掉
  }
}
