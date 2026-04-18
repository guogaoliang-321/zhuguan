import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  badRequest,
  forbidden,
} from "@/lib/api-utils";
import {
  canManageMilestones,
  canCompleteMilestone,
} from "@/lib/permissions";
import { z } from "zod";

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  phase: z.enum(["SCHEME", "PRELIMINARY", "CONSTRUCTION", "COMPLETION"]).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional(),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

type RouteParams = { params: Promise<{ id: string; milestoneId: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id, milestoneId } = await params;
  const body = await request.json();
  const parsed = updateMilestoneSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const existing = await prisma.milestone.findUnique({
    where: { id: milestoneId },
  });
  if (!existing) return notFound("节点不存在");

  const project = await prisma.project.findUnique({
    where: { id },
    select: { leadId: true },
  });
  if (!project) return notFound("项目不存在");

  const data = parsed.data;

  // 仅勾选完成状态的请求：assignee 也可以操作自己的节点
  const onlyToggleCompletion =
    data.isCompleted !== undefined &&
    data.name === undefined &&
    data.phase === undefined &&
    data.description === undefined &&
    data.dueDate === undefined &&
    data.assigneeId === undefined &&
    data.sortOrder === undefined;

  const allowed = onlyToggleCompletion
    ? canCompleteMilestone(
        session.user,
        { assigneeId: existing.assigneeId },
        project
      )
    : canManageMilestones(session.user, project);

  if (!allowed) return forbidden();

  const updateData: Record<string, unknown> = { ...data };

  if (data.dueDate) {
    updateData.dueDate = new Date(data.dueDate);
  }
  if (data.isCompleted !== undefined) {
    updateData.completedAt = data.isCompleted ? new Date() : null;
  }

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: updateData,
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(milestone);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id, milestoneId } = await params;

  const existing = await prisma.milestone.findUnique({
    where: { id: milestoneId },
  });
  if (!existing) return notFound("节点不存在");

  const project = await prisma.project.findUnique({
    where: { id },
    select: { leadId: true },
  });
  if (!project) return notFound("项目不存在");
  if (!canManageMilestones(session.user, project)) return forbidden();

  await prisma.milestone.delete({ where: { id: milestoneId } });

  return NextResponse.json({ success: true });
}
