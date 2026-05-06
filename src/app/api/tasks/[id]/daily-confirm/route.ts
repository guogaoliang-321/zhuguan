import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  forbidden,
  badRequest,
} from "@/lib/api-utils";
import { canConfirmTaskByEmployee, type SessionUser } from "@/lib/permissions";

/**
 * POST /api/tasks/[id]/daily-confirm
 *
 * 员工每日承诺"今天会做这个任务"。
 * - 仅任务责任人本人可调用
 * - Task.confirmedAt 设置为现在
 * - 同一天内重复调用幂等
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, assigneeId: true, projectId: true, status: true, confirmedAt: true },
  });
  if (!task) return notFound("任务不存在");
  if (!canConfirmTaskByEmployee(user, task)) return forbidden();
  if (task.status === "done") {
    return badRequest("已完成任务无需再次确认");
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { confirmedAt: new Date() },
    select: { id: true, confirmedAt: true },
  });

  return NextResponse.json(updated);
}
