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
  workLogVisibilityFilter,
  canCreateWorkLogFor,
  isAdmin,
  isProjectLead,
} from "@/lib/permissions";
import { z } from "zod";

const createWorklogSchema = z
  .object({
    projectId: z.string().optional(),
    nonProjectCategoryId: z.string().optional(),
    taskId: z.string().optional().nullable(),
    date: z.string().min(1, "请选择日期"),
    hours: z.number().min(0.5, "工时至少0.5小时").max(24),
    content: z.string().min(1, "请填写工作内容"),
    category: z.string().optional(),
    userId: z.string().optional(),
  })
  .refine((d) => d.projectId || d.nonProjectCategoryId, {
    message: "请选择项目或非项目类别",
  });

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const searchParams = request.nextUrl.searchParams;
  const userIdParam = searchParams.get("userId");
  const projectId = searchParams.get("projectId");

  // 权限过滤：ADMIN 全部；PROJECT_LEAD 本人+自己负责项目；MEMBER 仅本人
  const visibility = workLogVisibilityFilter(session.user);
  const extra: Record<string, unknown> = {};

  if (userIdParam) {
    // 如果显式请求特定用户，也要落到 visibility 之内
    if (
      isAdmin(session.user) ||
      userIdParam === session.user.id ||
      isProjectLead(session.user)
    ) {
      extra.userId = userIdParam;
    } else {
      return forbidden();
    }
  }
  if (projectId) extra.projectId = projectId;

  const where = { AND: [visibility, extra] };

  const logs = await prisma.workLog.findMany({
    where,
    include: {
      project: { select: { id: true, name: true } },
      nonProjectCategory: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createWorklogSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const data = parsed.data;
  const targetUserId = data.userId ?? session.user.id;

  if (data.projectId) {
    // 项目关联模式：验证项目存在且有权限
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { leadId: true, members: { select: { userId: true } } },
    });
    if (!project) return notFound("项目不存在");
    if (!canCreateWorkLogFor(session.user, targetUserId, project))
      return forbidden();
    // 关联任务校验：必须属于该项目，责任人必须是 targetUserId（ADMIN 例外）
    if (data.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        select: { projectId: true, assigneeId: true },
      });
      if (!task) return notFound("关联任务不存在");
      if (task.projectId !== data.projectId)
        return badRequest("任务不属于该项目");
      if (!isAdmin(session.user) && task.assigneeId !== targetUserId)
        return badRequest("只能关联自己被派的任务");
    }
  } else {
    // 非项目模式：只能给自己填（ADMIN 例外）
    if (targetUserId !== session.user.id && !isAdmin(session.user))
      return forbidden();
    // 验证类别存在
    const cat = await prisma.nonProjectCategory.findUnique({
      where: { id: data.nonProjectCategoryId! },
    });
    if (!cat) return notFound("非项目类别不存在");
  }

  const log = await prisma.workLog.create({
    data: {
      userId: targetUserId,
      projectId: data.projectId ?? null,
      nonProjectCategoryId: data.nonProjectCategoryId ?? null,
      taskId: data.taskId ?? null,
      date: new Date(data.date),
      hours: data.hours,
      content: data.content,
      category: data.category ?? null,
    },
    include: {
      project: { select: { id: true, name: true } },
      nonProjectCategory: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(log, { status: 201 });
}
