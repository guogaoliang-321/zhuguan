import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  forbidden,
} from "@/lib/api-utils";

/** PATCH /api/notifications/[id] — 标记已读（仅本人） */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const n = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!n) return notFound("通知不存在");
  if (n.userId !== session.user.id) return forbidden();

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return NextResponse.json(updated);
}
