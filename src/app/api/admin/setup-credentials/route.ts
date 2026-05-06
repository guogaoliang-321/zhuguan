/**
 * 一次性 API：批量同步用户和登录信息
 *
 * 调用：POST /api/admin/setup-credentials?secret=<NEXTAUTH_SECRET>
 *
 * 请求体（可选）：
 *   {
 *     "users": [
 *       { "name": "...", "role": "ADMIN|PROJECT_LEAD|MEMBER",
 *         "idNumber": "...", "phone": "...", "specialty": "...", "position": "..." },
 *       ...
 *     ],
 *     "removeUsernames": ["zhangmingyuan", ...]  // 用于清理演示数据
 *   }
 *
 * 行为：
 * 1. 删除 removeUsernames 列表里的 isActive 用户（软删: isActive=false）
 * 2. 对每个 users 项：按 name 查找，没有则创建；密码 = idNumber.slice(-8)
 * 3. 把所有现存活跃用户的 username 改为中文姓名
 *
 * 用完即可从 middleware 排除列表里删除，并把这个文件删掉。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员",
  PROJECT_LEAD: "项目负责人",
  MEMBER: "普通员工",
};

interface IncomingUser {
  name: string;
  role: "ADMIN" | "PROJECT_LEAD" | "MEMBER";
  idNumber?: string | null;
  phone?: string | null;
  specialty?: string | null;
  position?: string | null;
}

function pickPassword(name: string, idNumber: string | null | undefined): string {
  if (idNumber && idNumber.length >= 8) return idNumber.slice(-8);
  if (name === "郭高亮") return "admin123";
  return "888888";
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    users?: IncomingUser[];
    removeUsernames?: string[];
  };
  const incomingUsers = body.users ?? [];
  const removeUsernames = body.removeUsernames ?? [];

  const removed: string[] = [];
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  // 1. 软删除指定用户名（用 isActive=false 而不是真删，保留外键）
  for (const uname of removeUsernames) {
    try {
      const r = await prisma.user.updateMany({
        where: { username: uname, isActive: true },
        data: { isActive: false },
      });
      if (r.count > 0) removed.push(uname);
    } catch {
      skipped.push(`remove ${uname} 失败`);
    }
  }

  // 2. 按 name 创建缺失用户
  for (const u of incomingUsers) {
    try {
      const exists = await prisma.user.findFirst({ where: { name: u.name } });
      if (exists) continue;
      const plainPwd = pickPassword(u.name, u.idNumber);
      const hashed = await bcrypt.hash(plainPwd, 10);
      // 临时 username，后面统一改成中文名
      const tempUsername = `__pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.user.create({
        data: {
          username: tempUsername,
          password: hashed,
          name: u.name,
          role: u.role,
          idNumber: u.idNumber ?? null,
          phone: u.phone ?? null,
          specialty: u.specialty ?? null,
          position: u.position ?? null,
        },
      });
      created.push(u.name);
    } catch (e) {
      skipped.push(`create ${u.name}: ${(e as Error).message}`);
    }
  }

  // 3. 把所有活跃用户的 username 改为中文名 + 重置密码
  const activeUsers = await prisma.user.findMany({ where: { isActive: true } });

  // 重名校验
  const nameCount = new Map<string, number>();
  activeUsers.forEach((u) => nameCount.set(u.name, (nameCount.get(u.name) ?? 0) + 1));
  const dups = [...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  if (dups.length > 0) {
    return NextResponse.json(
      { error: "存在重名活跃用户", dups, removed, created },
      { status: 400 }
    );
  }

  const rows: { name: string; role: string; username: string; password: string }[] = [];
  for (const u of activeUsers) {
    try {
      const plainPwd = pickPassword(u.name, u.idNumber);
      const hashed = await bcrypt.hash(plainPwd, 10);
      await prisma.user.update({
        where: { id: u.id },
        data: { username: u.name, password: hashed },
      });
      updated.push(u.name);
      rows.push({
        name: u.name,
        role: ROLE_LABEL[u.role] ?? u.role,
        username: u.name,
        password: plainPwd,
      });
    } catch (e) {
      skipped.push(`update ${u.name}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    removed,
    created,
    updatedCount: updated.length,
    skipped,
    rows,
  });
}
