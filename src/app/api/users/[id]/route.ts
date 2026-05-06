import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api-utils";
import { canManageUsers, isAdmin } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "PROJECT_LEAD", "MEMBER"]).optional(),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  specialty: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  weeklyCapacity: z.number().min(1).max(80).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  // 只有本人或 ADMIN 可看
  if (id !== session.user.id && !isAdmin(session.user)) return forbidden();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      phone: true,
      idNumber: isAdmin(session.user),
      specialty: true,
      department: true,
      position: true,
      weeklyCapacity: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!user) return notFound("用户不存在");
  return NextResponse.json(user);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  // 本人可改自己的基本信息和密码；ADMIN 可改所有
  const isSelf = id === session.user.id;
  if (!isSelf && !canManageUsers(session.user)) return forbidden();

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const { password, role, isActive, idNumber, ...rest } = parsed.data;

  // 非管理员不能改角色和激活状态
  const updateData: Record<string, unknown> = { ...rest };
  if (canManageUsers(session.user)) {
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (idNumber !== undefined) updateData.idNumber = idNumber;
  }
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  // 取审计前镜像（仅当 role/password 变化或 ADMIN 改他人时记）
  const before = await prisma.user.findUnique({
    where: { id },
    select: { role: true, isActive: true },
  });

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, username: true, role: true, specialty: true },
  });

  // 写审计：role 变更
  if (
    canManageUsers(session.user) &&
    role !== undefined &&
    before &&
    before.role !== role
  ) {
    await writeAudit({
      actorId: session.user.id,
      action: "user_role_change",
      targetType: "user",
      targetId: id,
      before: { role: before.role },
      after: { role },
    });
  }
  // 写审计：ADMIN 重置他人密码
  if (password && !isSelf && canManageUsers(session.user)) {
    await writeAudit({
      actorId: session.user.id,
      action: "user_password_reset",
      targetType: "user",
      targetId: id,
    });
  }

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.user)) return forbidden();

  const { id } = await params;

  // 软删除（标记 isActive = false）
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, name: true },
  });

  return NextResponse.json(user);
}
