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
  canResolveAppeals,
  canViewAppeal,
  type SessionUser,
} from "@/lib/permissions";
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
  if (!canViewAppeal(user, appeal)) return forbidden();

  return NextResponse.json(appeal);
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
  if (!canResolveAppeals(user)) return forbidden();

  const { id } = await params;
  const body = await request.json();
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const existing = await prisma.appeal.findUnique({
    where: { id },
    select: { authorId: true, status: true },
  });
  if (!existing) return notFound("申诉不存在");
  if (existing.status !== "pending") {
    return badRequest("该申诉已处理");
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

  return NextResponse.json(updated);
}
