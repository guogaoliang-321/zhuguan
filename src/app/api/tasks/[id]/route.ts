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
  canViewTask,
  canEditTask,
  canDeleteTask,
  type SessionUser,
} from "@/lib/permissions";
import { refreshOverdueTasks, logStatusChange } from "@/lib/task-helpers";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  assigneeId: z.string().min(1).optional(),
  estimatedHours: z.number().min(0.5).optional(),
  priority: z.enum(["normal", "urgent"]).optional(),
  plannedStart: z.string().min(1).optional(),
  plannedEnd: z.string().min(1).optional(),
  milestoneId: z.string().nullable().optional(),
});

/** GET /api/tasks/[id] — 任务详情（含状态历史 + 关联工时） */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  const { id } = await params;

  await refreshOverdueTasks();

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, specialty: true } },
      createdBy: { select: { id: true, name: true } },
      project: {
        select: {
          id: true,
          name: true,
          leadId: true,
          members: { select: { userId: true } },
        },
      },
      milestone: { select: { id: true, name: true, phase: true } },
      statusLogs: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: "desc" },
      },
      workLogs: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!task) return notFound("任务不存在");
  if (!canViewTask(user, task, task.project ?? undefined)) {
    return forbidden();
  }

  return NextResponse.json(task);
}

/** PATCH /api/tasks/[id] — 更新任务字段（不含状态变更） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { leadId: true } } },
  });
  if (!task) return notFound("任务不存在");
  if (!canEditTask(user, task, task.project ?? undefined)) return forbidden();

  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const data = parsed.data;

  const plannedStart = data.plannedStart ? new Date(data.plannedStart) : task.plannedStart;
  const plannedEnd = data.plannedEnd ? new Date(data.plannedEnd) : task.plannedEnd;
  if (plannedEnd <= plannedStart) {
    return badRequest("计划结束时间必须晚于开始时间");
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
      ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
      ...(data.estimatedHours !== undefined ? { estimatedHours: data.estimatedHours } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.plannedStart !== undefined ? { plannedStart } : {}),
      ...(data.plannedEnd !== undefined ? { plannedEnd } : {}),
      ...(data.milestoneId !== undefined ? { milestoneId: data.milestoneId } : {}),
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/tasks/[id] */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { leadId: true } } },
  });
  if (!task) return notFound("任务不存在");
  if (!canDeleteTask(user, task, task.project ?? undefined)) return forbidden();

  // 删除前先记一条日志（保留申诉/审计可追溯性）
  await prisma.$transaction(async (tx) => {
    await logStatusChange(tx, {
      taskId: id,
      fromStatus: task.status,
      toStatus: "deleted",
      reason: "任务已删除",
      changedById: user.id,
    });
    await tx.task.delete({ where: { id } });
  });

  await writeAudit({
    actorId: user.id,
    action: "task_delete",
    targetType: "task",
    targetId: id,
    before: {
      name: task.name,
      status: task.status,
      assigneeId: task.assigneeId,
      projectId: task.projectId,
      estimatedHours: Number(task.estimatedHours),
    },
  });

  return NextResponse.json({ ok: true });
}
