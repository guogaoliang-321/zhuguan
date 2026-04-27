import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { canManageUsers } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { pinyin } from "pinyin-pro";

const ROLE_MAP: Record<string, "ADMIN" | "PROJECT_LEAD" | "MEMBER"> = {
  管理员: "ADMIN",
  项目负责人: "PROJECT_LEAD",
  普通员工: "MEMBER",
};

function generateUsername(name: string, existingUsernames: Set<string>): string {
  const base = pinyin(name, { toneType: "none", separator: "" })
    .toLowerCase()
    .replace(/\s/g, "");
  let username = base;
  let n = 2;
  while (existingUsernames.has(username)) {
    username = `${base}${n++}`;
  }
  existingUsernames.add(username);
  return username;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.user)) return forbidden();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return badRequest("请上传 Excel 文件");

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  if (rows.length === 0) return badRequest("Excel 文件内容为空");

  // 获取已有用户名集合
  const existingUsers = await prisma.user.findMany({ select: { username: true } });
  const existingUsernames = new Set(existingUsers.map((u) => u.username));

  const results: {
    name: string;
    username: string;
    success: boolean;
    error?: string;
  }[] = [];

  for (const row of rows) {
    const name = String(row["姓名"] ?? "").trim();
    const phone = String(row["手机"] ?? "").trim();
    const idNumber = String(row["身份证号"] ?? "").trim();
    const roleStr = String(row["角色"] ?? "普通员工").trim();
    const specialty = String(row["专业"] ?? "").trim();
    const remark = String(row["备注"] ?? "").trim();

    if (!name) {
      results.push({ name: "(空)", username: "", success: false, error: "姓名不能为空" });
      continue;
    }

    const role = ROLE_MAP[roleStr] ?? "MEMBER";
    const username = generateUsername(name, existingUsernames);
    const rawPassword = idNumber.length >= 8 ? idNumber.slice(-8) : "12345678";
    const password = await bcrypt.hash(rawPassword, 10);

    try {
      await prisma.user.create({
        data: {
          username,
          password,
          name,
          role,
          phone: phone || null,
          idNumber: idNumber || null,
          specialty: specialty || null,
          position: remark || null,
        },
      });
      results.push({ name, username, success: true });
    } catch {
      results.push({ name, username, success: false, error: "创建失败（可能已存在）" });
    }
  }

  return NextResponse.json({ total: rows.length, results });
}
