import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canEditWorkLog } from "@/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const log = await prisma.workLog.findUnique({ where: { id } });
  if (!log) return notFound("记录不存在");

  if (!canEditWorkLog(session.user, log)) return forbidden();

  await prisma.workLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
