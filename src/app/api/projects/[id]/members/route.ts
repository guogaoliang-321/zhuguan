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

const addMemberSchema = z
  .object({
    // 单个成员（兼容旧接口）
    userId: z.string().optional(),
    role: z.string().optional(),
    // 批量成员（新增）
    userIds: z.array(z.string()).optional(),
  })
  .refine((d) => d.userId || (d.userIds && d.userIds.length > 0), {
    message: "请选择至少一个成员",
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

  // 标准化为列表
  const userIds = parsed.data.userIds ?? (parsed.data.userId ? [parsed.data.userId] : []);

  // 已存在的成员剔除（避免冲突报错）
  const existing = await prisma.projectMember.findMany({
    where: { projectId: id, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((e) => e.userId));
  const toAdd = userIds.filter((uid) => !existingSet.has(uid));

  if (toAdd.length === 0) {
    return badRequest("所选成员已全部在项目中");
  }

  // 拉取这批成员的 specialty 作为默认 role
  const users = await prisma.user.findMany({
    where: { id: { in: toAdd } },
    select: { id: true, specialty: true, position: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const fallbackRole = parsed.data.role?.trim() || "";

  await prisma.projectMember.createMany({
    data: toAdd.map((uid) => {
      const u = userMap.get(uid);
      const role = fallbackRole || u?.specialty || u?.position || "成员";
      return { projectId: id, userId: uid, role };
    }),
  });

  return NextResponse.json(
    { added: toAdd.length, skipped: existing.length },
    { status: 201 }
  );
}
