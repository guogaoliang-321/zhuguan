import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canManageMilestones } from "@/lib/permissions";
import { z } from "zod";

const createMilestoneSchema = z.object({
  name: z.string().min(1, "节点名称不能为空"),
  phase: z.enum(["SCHEME", "PRELIMINARY", "CONSTRUCTION", "COMPLETION"]),
  description: z.string().optional().nullable(),
  dueDate: z.string().min(1, "截止日期不能为空"),
  assigneeId: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { leadId: true },
  });
  if (!project) return notFound("项目不存在");
  if (!canManageMilestones(session.user, project)) return forbidden();

  const body = await request.json();
  const parsed = createMilestoneSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const data = parsed.data;

  const milestone = await prisma.milestone.create({
    data: {
      projectId: id,
      name: data.name,
      phase: data.phase,
      description: data.description ?? null,
      dueDate: new Date(data.dueDate),
      assigneeId: data.assigneeId ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(milestone, { status: 201 });
}
