import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/api-utils";
import { canConfirmWorkLog } from "@/lib/permissions";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const log = await prisma.workLog.findUnique({
    where: { id },
    select: {
      id: true,
      confirmedAt: true,
      projectId: true,
      project: { select: { leadId: true, members: { select: { userId: true } } } },
    },
  });
  if (!log) return notFound("工作记录不存在");

  if (!canConfirmWorkLog(session.user, log.project ?? undefined)) {
    return forbidden();
  }

  if (log.confirmedAt) {
    return NextResponse.json({ confirmed: true, confirmedAt: log.confirmedAt });
  }

  const updated = await prisma.workLog.update({
    where: { id },
    data: { confirmedAt: new Date(), confirmedById: session.user.id },
    select: { id: true, confirmedAt: true, confirmedById: true },
  });

  return NextResponse.json({ confirmed: true, ...updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const log = await prisma.workLog.findUnique({
    where: { id },
    select: {
      id: true,
      project: { select: { leadId: true, members: { select: { userId: true } } } },
    },
  });
  if (!log) return notFound("工作记录不存在");

  if (!canConfirmWorkLog(session.user, log.project ?? undefined)) {
    return forbidden();
  }

  const updated = await prisma.workLog.update({
    where: { id },
    data: { confirmedAt: null, confirmedById: null },
    select: { id: true, confirmedAt: true },
  });

  return NextResponse.json({ confirmed: false, ...updated });
}
