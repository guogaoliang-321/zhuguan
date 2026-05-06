import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canPMConfirmTask, type SessionUser } from "@/lib/permissions";
import { logStatusChange } from "@/lib/task-helpers";
import { z } from "zod";

const confirmSchema = z.object({
  approve: z.boolean(),
  reason: z.string().optional().nullable(),
});

/**
 * POST /api/tasks/[id]/pm-confirm
 *
 * approve=true → 设置 pmConfirmedAt
 * approve=false → 状态回退为 in_progress + 必填拒绝原因
 *
 * 权限：ADMIN 或项目负责人
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
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { approve, reason } = parsed.data;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { leadId: true } } },
  });
  if (!task) return notFound("任务不存在");
  if (!canPMConfirmTask(user, task, task.project ?? undefined)) {
    return forbidden();
  }
  if (task.status !== "done") {
    return badRequest("仅已勾选完成的任务可由 PM 确认");
  }
  if (!approve && !reason) {
    return badRequest("拒绝确认必须填写原因");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (approve) {
      const t = await tx.task.update({
        where: { id },
        data: { pmConfirmedAt: new Date() },
      });
      await logStatusChange(tx, {
        taskId: id,
        fromStatus: "done",
        toStatus: "done",
        reason: "PM 确认完成",
        changedById: user.id,
      });
      return t;
    }
    // 拒绝：状态回退
    const t = await tx.task.update({
      where: { id },
      data: { status: "in_progress", completedAt: null },
    });
    await logStatusChange(tx, {
      taskId: id,
      fromStatus: "done",
      toStatus: "in_progress",
      reason: `PM 拒绝确认：${reason}`,
      changedById: user.id,
    });
    return t;
  });

  return NextResponse.json(updated);
}
