import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import {
  canMarkTaskDone,
  canEditTask,
  type SessionUser,
  type TaskStatus,
} from "@/lib/permissions";
import { canTransition, isValidTaskStatus, logStatusChange } from "@/lib/task-helpers";
import { z } from "zod";

const transitionSchema = z.object({
  toStatus: z.enum(["in_progress", "done", "overdue", "pending"]),
  reason: z.string().optional().nullable(),
});

/**
 * POST /api/tasks/[id]/status — 状态变更
 *
 * 权限：
 * - 切到 done：必须 canMarkTaskDone（责任人或 ADMIN）
 * - 其他状态变更：必须 canEditTask（PM 或 ADMIN）
 *
 * 写 TaskStatusLog；reason 为延期/恢复/插队等业务原因
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  const { id } = await params;

  const body = await request.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { toStatus, reason } = parsed.data;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { leadId: true, members: { select: { userId: true } } } } },
  });
  if (!task) return notFound("任务不存在");

  if (!isValidTaskStatus(task.status)) {
    return badRequest("任务状态异常，请联系管理员");
  }

  // 权限分支
  if (toStatus === "done") {
    if (!canMarkTaskDone(user, task)) return forbidden();
  } else {
    if (!canEditTask(user, task, task.project ?? undefined)) return forbidden();
  }

  const fromStatus = task.status as TaskStatus;
  if (!canTransition(fromStatus, toStatus)) {
    return badRequest(`不允许从 ${fromStatus} 切到 ${toStatus}`);
  }

  // 切到 overdue 必须给原因（人工标记，区别于系统 lazy 刷新）
  if (toStatus === "overdue" && !reason) {
    return badRequest("标记延期必须填写原因");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = { status: toStatus };
    if (toStatus === "done") {
      updateData.completedAt = new Date();
    }
    const t = await tx.task.update({ where: { id }, data: updateData });
    await logStatusChange(tx, {
      taskId: id,
      fromStatus,
      toStatus,
      reason: reason ?? null,
      changedById: user.id,
    });
    return t;
  });

  return NextResponse.json(updated);
}
