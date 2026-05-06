import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  forbidden,
  badRequest,
} from "@/lib/api-utils";
import {
  canResolveAppeal,
  canViewAppeal,
  type SessionUser,
} from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

/** GET /api/appeals/[id] — 详情 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  const { id } = await params;

  const appeal = await prisma.appeal.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });
  if (!appeal) return notFound("申诉不存在");

  // 找申诉对象所属项目（用于 PM 权限判定）
  const targetProject = await fetchTargetProject(appeal);
  if (!canViewAppeal(user, appeal, targetProject ?? undefined)) {
    return forbidden();
  }

  return NextResponse.json(appeal);
}

async function fetchTargetProject(appeal: {
  targetType: string;
  targetId: string;
}): Promise<{ leadId: string } | null> {
  if (appeal.targetType === "task" || appeal.targetType === "task_status") {
    const t = await prisma.task.findUnique({
      where: { id: appeal.targetId },
      select: { project: { select: { leadId: true } } },
    });
    return t?.project ?? null;
  }
  return null;
}

const resolveSchema = z.object({
  status: z.enum(["accepted", "rejected", "resolved"]),
  resolution: z.string().min(1, "请说明处理结果"),
});

/** PATCH /api/appeals/[id] — ADMIN 处理申诉 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;

  const { id } = await params;
  const body = await request.json();
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const existing = await prisma.appeal.findUnique({
    where: { id },
    select: { authorId: true, status: true, targetType: true, targetId: true },
  });
  if (!existing) return notFound("申诉不存在");
  if (existing.status !== "pending") {
    return badRequest("该申诉已处理");
  }

  const targetProject = await fetchTargetProject(existing);
  if (!canResolveAppeal(user, existing, targetProject ?? undefined)) {
    return forbidden();
  }

  const updated = await prisma.appeal.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolution: parsed.data.resolution,
      resolvedById: user.id,
      resolvedAt: new Date(),
    },
  });

  // 通知申诉人
  await prisma.notification.create({
    data: {
      userId: existing.authorId,
      type: "appeal_update",
      title: `申诉已${parsed.data.status === "accepted" ? "受理" : parsed.data.status === "rejected" ? "驳回" : "处理"}`,
      message: parsed.data.resolution,
      linkType: "appeal",
      linkId: id,
      payload: { appealId: id, status: parsed.data.status },
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "appeal_resolve",
    targetType: "appeal",
    targetId: id,
    before: { status: "pending" },
    after: { status: parsed.data.status, resolution: parsed.data.resolution },
    meta: { authorId: existing.authorId, targetType: existing.targetType },
  });

  return NextResponse.json(updated);
}
