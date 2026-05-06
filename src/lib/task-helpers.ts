/**
 * Task 辅助函数：状态机 / 逾期 lazy 刷新 / 插队顺延
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus, TaskPriority } from "@/lib/permissions";

export const TASK_STATUS_VALUES: TaskStatus[] = [
  "pending",
  "in_progress",
  "done",
  "overdue",
];

export const TASK_PRIORITY_VALUES: TaskPriority[] = ["normal", "urgent"];

export function isValidTaskStatus(s: string): s is TaskStatus {
  return TASK_STATUS_VALUES.includes(s as TaskStatus);
}

/**
 * 状态合法迁移表
 * pending → in_progress | overdue
 * in_progress → done | overdue
 * overdue → in_progress | done（允许补救）
 * done → 不允许再变（除非 PM 拒绝确认，由 pmConfirmedAt 流程处理）
 */
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "overdue"],
  in_progress: ["done", "overdue"],
  overdue: ["in_progress", "done"],
  done: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Lazy 刷新逾期状态：把所有 plannedEnd < now 且状态非 done/overdue 的任务批量置为 overdue。
 * 单条 SQL，性能可接受，作为列表/详情 API 的前置调用。
 * 不写 TaskStatusLog（系统自动行为，避免日志爆炸）。
 */
export async function refreshOverdueTasks(): Promise<number> {
  const result = await prisma.task.updateMany({
    where: {
      plannedEnd: { lt: new Date() },
      status: { in: ["pending", "in_progress"] },
    },
    data: { status: "overdue" },
  });
  return result.count;
}

/**
 * 插队顺延：为 assigneeId 的所有 pending 任务，
 * 把 plannedStart >= insertionStart 的任务整体后移 shiftMs 毫秒。
 * 必须在事务内调用（tx 参数）。
 */
export async function shiftSubsequentTasks(
  tx: Prisma.TransactionClient,
  assigneeId: string,
  insertionStart: Date,
  shiftMs: number
): Promise<number> {
  if (shiftMs <= 0) return 0;

  const affected = await tx.task.findMany({
    where: {
      assigneeId,
      status: "pending",
      plannedStart: { gte: insertionStart },
    },
    select: { id: true, plannedStart: true, plannedEnd: true },
  });

  for (const t of affected) {
    await tx.task.update({
      where: { id: t.id },
      data: {
        plannedStart: new Date(t.plannedStart.getTime() + shiftMs),
        plannedEnd: new Date(t.plannedEnd.getTime() + shiftMs),
      },
    });
  }

  return affected.length;
}

/** 写一条状态变更日志（任意调用方提供 reason） */
export async function logStatusChange(
  tx: Prisma.TransactionClient,
  params: {
    taskId: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    changedById: string;
  }
): Promise<void> {
  await tx.taskStatusLog.create({
    data: {
      taskId: params.taskId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      reason: params.reason,
      changedById: params.changedById,
    },
  });
}
