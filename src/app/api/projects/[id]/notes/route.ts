import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canAddNote } from "@/lib/permissions";
import { z } from "zod";

const createNoteSchema = z.object({
  content: z.string().min(1, "备注内容不能为空"),
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
    select: {
      leadId: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) return notFound("项目不存在");
  if (!canAddNote(session.user, project)) return forbidden();

  const body = await request.json();
  const parsed = createNoteSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const note = await prisma.projectNote.create({
    data: {
      projectId: id,
      authorId: session.user.id,
      content: parsed.data.content,
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(note, { status: 201 });
}
