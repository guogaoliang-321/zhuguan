/**
 * 离职员工匿名化（不可逆）
 *
 * POST /api/admin/users/[id]/anonymize
 * - 仅 ADMIN
 * - 清空 idNumber/phone/avatar/department/position
 * - username 改为 "anon-<8 位随机>"，避免后续与新人重名
 * - 密码重置为不可登录的随机字符串
 * - isActive=false
 * - 保留 name（用于历史归属，比如老任务的"责任人"还能显示）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api-utils";
import { canManageUsers } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.user)) return forbidden();

  const { id } = await params;
  if (id === session.user.id) {
    return badRequest("不能匿名化自己");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      username: true,
      idNumber: true,
      phone: true,
      department: true,
      position: true,
    },
  });
  if (!user) return notFound("用户不存在");
  if (user.role === "ADMIN") {
    return badRequest("不能匿名化其他管理员，请先把对方降级为普通员工");
  }

  const anonUsername = `anon-${randomBytes(4).toString("hex")}`;
  const lockPassword = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      username: anonUsername,
      password: lockPassword,
      idNumber: null,
      phone: null,
      avatar: null,
      department: null,
      position: null,
      isActive: false,
    },
    select: { id: true, name: true, isActive: true, username: true },
  });

  // 审计：仅记录字段是否曾有值（不记原文身份证号，避免泄漏）
  await writeAudit({
    actorId: session.user.id,
    action: "user_anonymize",
    targetType: "user",
    targetId: id,
    before: {
      hadIdNumber: Boolean(user.idNumber),
      hadPhone: Boolean(user.phone),
      department: user.department,
      position: user.position,
      username: user.username,
    },
    after: { username: anonUsername, isActive: false },
    meta: { name: user.name, role: user.role },
  });

  return NextResponse.json(updated);
}
