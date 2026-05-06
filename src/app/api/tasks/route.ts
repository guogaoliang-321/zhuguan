import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
  forbidden,
  notFound,
} from "@/lib/api-utils";
import {
  canCreateTask,
  taskVisibilityFilter,
  type SessionUser,
} from "@/lib/permissions";
import {
  refreshOverdueTasks,
  shiftSubsequentTasks,
  logStatusChange,
} from "@/lib/task-helpers";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const createTaskSchema = z.object({
  name: z.string().min(1, "任务名称不能为空"),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
  assigneeId: z.string().min(1, "必须指定责任人"),
  estimatedHours: z.number().min(0.5, "预估工时至少 0.5 小时"),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  isInsertion: z.boolean().default(false),
  insertionReason: z.string().optional().nullable(),
  plannedStart: z.string().min(1, "计划开始时间不能为空"),
  plannedEnd: z.string().min(1, "计划结束时间不能为空"),
});

/** GET /api/tasks — 任务列表，支持过滤 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;

  await refreshOverdueTasks();

  const sp = request.nextUrl.searchParams;
  const projectId = sp.get("projectId");
  const assigneeId = sp.get("assigneeId");
  const status = sp.get("status");
  const mineOnly = sp.get("mine") === "1";

  const where: Prisma.TaskWhereInput = {
    AND: [
      taskVisibilityFilter(user),
      projectId ? { projectId } : {},
      assigneeId ? { assigneeId } : {},
      mineOnly ? { assigneeId: user.id } : {},
      status ? { status } : {},
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, specialty: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, leadId: true } },
      milestone: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: "desc" }, { plannedEnd: "asc" }],
  });

  return NextResponse.json(tasks);
}

/** POST /api/tasks — 创建任务（支持插队顺延） */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const data = parsed.data;

  const plannedStart = new Date(data.plannedStart);
  const plannedEnd = new Date(data.plannedEnd);
  if (plannedEnd <= plannedStart) {
    return badRequest("计划结束时间必须晚于开始时间");
  }
  if (data.isInsertion && !data.insertionReason) {
    return badRequest("插队任务必须填写插队原因");
  }

  // 权限：必须指定 projectId 或 ADMIN
  let projectCtx: { leadId: string } | null = null;
  if (data.projectId) {
    const p = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { leadId: true },
    });
    if (!p) return notFound("项目不存在");
    projectCtx = p;
  }
  if (!canCreateTask(user, projectCtx ?? undefined)) {
    return forbidden();
  }

  // 校验责任人存在
  const assignee = await prisma.user.findUnique({
    where: { id: data.assigneeId },
    select: { id: true, isActive: true },
  });
  if (!assignee || !assignee.isActive) return badRequest("责任人无效");

  const task = await prisma.$transaction(async (tx) => {
    // 1. 插队顺延（若需）
    let shiftedCount = 0;
    if (data.isInsertion) {
      const shiftMs = plannedEnd.getTime() - plannedStart.getTime();
      shiftedCount = await shiftSubsequentTasks(
        tx,
        data.assigneeId,
        plannedStart,
        shiftMs
      );
    }

    // 2. 创建任务
    const created = await tx.task.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        projectId: data.projectId ?? null,
        milestoneId: data.milestoneId ?? null,
        specialty: data.specialty ?? null,
        assigneeId: data.assigneeId,
        createdById: user.id,
        estimatedHours: data.estimatedHours,
        priority: data.priority,
        isInsertion: data.isInsertion,
        insertionReason: data.insertionReason ?? null,
        plannedStart,
        plannedEnd,
        status: "pending",
      },
    });

    // 3. 写一条创建日志
    await logStatusChange(tx, {
      taskId: created.id,
      fromStatus: null,
      toStatus: "pending",
      reason: data.isInsertion
        ? `插队创建：${data.insertionReason}（顺延 ${shiftedCount} 个后续任务）`
        : "新建任务",
      changedById: user.id,
    });

    return created;
  });

  return NextResponse.json(task, { status: 201 });
}
