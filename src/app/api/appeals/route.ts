import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  badRequest,
} from "@/lib/api-utils";
import {
  canCreateAppeal,
  canResolveAppeals,
  isAdmin,
  type SessionUser,
} from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  targetType: z.enum(["task", "worklog", "score", "task_status"]),
  targetId: z.string().min(1),
  content: z.string().min(5, "申诉理由至少 5 个字"),
});

/** GET /api/appeals — 列表
 * - 普通员工：仅本人提交的
 * - ADMIN：全部（默认按 status pending 优先）
 * 支持 ?status=pending|accepted|rejected|resolved
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (!isAdmin(user)) where.authorId = user.id;

  const items = await prisma.appeal.findMany({
    where,
    include: {
      author: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(items);
}

/** POST /api/appeals — 提交申诉 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  if (!canCreateAppeal(user)) return unauthorized();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const data = parsed.data;

  // 校验目标存在性（防止瞎填 ID）
  if (data.targetType === "task") {
    const t = await prisma.task.findUnique({ where: { id: data.targetId } });
    if (!t) return badRequest("申诉目标任务不存在");
  } else if (data.targetType === "worklog") {
    const w = await prisma.workLog.findUnique({ where: { id: data.targetId } });
    if (!w) return badRequest("申诉目标工时不存在");
  }

  const appeal = await prisma.appeal.create({
    data: {
      authorId: user.id,
      targetType: data.targetType,
      targetId: data.targetId,
      content: data.content,
      status: "pending",
    },
  });

  // 通知所有 ADMIN
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "appeal_new",
      title: "新申诉待处理",
      message: `${session.user.name} 对${data.targetType === "task" ? "任务" : data.targetType === "worklog" ? "工时" : "数据"}提出申诉`,
      linkType: "appeal",
      linkId: appeal.id,
      payload: { appealId: appeal.id, authorId: user.id },
    })),
  });

  return NextResponse.json(appeal, { status: 201 });
}

// 临时支持 canResolveAppeals 在测试时编译通过
void canResolveAppeals;
