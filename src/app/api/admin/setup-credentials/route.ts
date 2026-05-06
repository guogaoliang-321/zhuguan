/**
 * 一次性 API：把所有用户的 username 改为中文姓名，密码改为身份证后 8 位。
 *
 * 调用：POST /api/admin/setup-credentials?secret=<NEXTAUTH_SECRET>
 * 返回：{ updated: number, skipped: string[], rows: { name, role, username, password }[] }
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

function pickPassword(user: { username: string; idNumber: string | null }): string {
  if (!user.idNumber || user.idNumber.length < 8) {
    return user.username === "guogaoliang" ? "admin123" : "888888";
  }
  return user.idNumber.slice(-8);
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ where: { isActive: true } });

  // 重名校验
  const nameCount = new Map<string, number>();
  users.forEach((u) => nameCount.set(u.name, (nameCount.get(u.name) ?? 0) + 1));
  const dups = [...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  if (dups.length > 0) {
    return NextResponse.json(
      { error: "存在重名用户，无法用姓名作 username", dups },
      { status: 400 }
    );
  }

  const rows: { name: string; role: string; username: string; password: string }[] = [];
  const skipped: string[] = [];

  for (const u of users) {
    try {
      const plainPwd = pickPassword(u);
      const hashed = await bcrypt.hash(plainPwd, 10);
      await prisma.user.update({
        where: { id: u.id },
        data: { username: u.name, password: hashed },
      });
      rows.push({
        name: u.name,
        role: ROLE_LABEL[u.role] ?? u.role,
        username: u.name,
        password: plainPwd,
      });
    } catch (e) {
      skipped.push(`${u.name}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ updated: rows.length, skipped, rows });
}
