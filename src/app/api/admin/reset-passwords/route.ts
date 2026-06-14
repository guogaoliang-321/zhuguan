/**
 * 临时接口：批量重置密码
 * - 有身份证号的员工 → 身份证后六位
 * - guogaoliang → ggl2494498
 *
 * 用完即删，勿长期保留。
 * 调用：POST /api/admin/reset-passwords
 *       Header: x-reset-secret: <RESET_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const SECRET = process.env.RESET_SECRET;

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "RESET_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("x-reset-secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { username: string; name: string; status: string }[] = [];

  // 1. 有身份证号的员工 → 后六位
  const users = await prisma.user.findMany({
    where: { idNumber: { not: null } },
    select: { id: true, username: true, name: true, idNumber: true },
  });

  for (const user of users) {
    const last6 = user.idNumber!.trim().slice(-6);
    if (last6.length < 6) {
      results.push({ username: user.username, name: user.name, status: "skipped: idNumber too short" });
      continue;
    }
    const hashed = await bcrypt.hash(last6, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    results.push({ username: user.username, name: user.name, status: "ok: last6 of idNumber" });
  }

  // 2. guogaoliang → ggl2494498
  const adminHash = await bcrypt.hash("ggl2494498", 10);
  await prisma.user.update({
    where: { username: "guogaoliang" },
    data: { password: adminHash },
  });
  results.push({ username: "guogaoliang", name: "郭高亮", status: "ok: ggl2494498" });

  return NextResponse.json({ success: true, count: results.length, results });
}
