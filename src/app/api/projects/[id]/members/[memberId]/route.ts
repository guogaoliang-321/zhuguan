import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canManageMembers } from "@/lib/permissions";

type RouteParams = { params: Promise<{ id: string; memberId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id, memberId } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { leadId: true },
  });
  if (!project) return notFound("项目不存在");
  if (!canManageMembers(session.user, project)) return forbidden();

  const existing = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });
  if (!existing) return notFound("成员不存在");

  await prisma.projectMember.delete({ where: { id: memberId } });

  return NextResponse.json({ success: true });
}
