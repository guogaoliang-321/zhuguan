import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canManageMembers } from "@/lib/permissions";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().min(1, "请选择成员"),
  role: z.string().min(1, "请填写项目角色"),
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
  if (!canManageMembers(session.user, project)) return forbidden();

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: parsed.data.userId } },
  });

  if (existing) {
    return badRequest("该成员已在项目中");
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId: id,
      userId: parsed.data.userId,
      role: parsed.data.role,
    },
    include: {
      user: { select: { id: true, name: true, position: true, department: true } },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
