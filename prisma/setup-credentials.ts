/**
 * 用户登录信息设置脚本
 *
 * - 把 username 改为中文姓名（方便同事直接键入）
 * - 把密码改为身份证后 8 位（管理员保留 admin123）
 * - 生成 docs/筑管登录账号清单.xlsx 用于分发
 *
 * 运行：
 *   本地：npx tsx prisma/setup-credentials.ts
 *   线上：DATABASE_URL="postgresql://..." npx tsx prisma/setup-credentials.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员",
  PROJECT_LEAD: "项目负责人",
  MEMBER: "普通员工",
};

const ROLE_ORDER: Record<string, number> = {
  ADMIN: 0,
  PROJECT_LEAD: 1,
  MEMBER: 2,
};

function pickPassword(user: {
  username: string;
  idNumber: string | null;
}): string {
  // 管理员（无身份证号）保留 admin123
  if (!user.idNumber || user.idNumber.length < 8) {
    return user.username === "guogaoliang" ? "admin123" : "888888";
  }
  return user.idNumber.slice(-8);
}

interface RowOut {
  姓名: string;
  角色: string;
  专业: string;
  职位: string;
  登录用户名: string;
  登录密码: string;
}

async function main() {
  console.log("📂 拉取用户列表...");
  const users = await prisma.user.findMany({
    where: { isActive: true },
  });

  // 排序：管理员 → 项目负责人 → 普通员工；同角色按专业、姓名
  users.sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    const sa = a.specialty ?? "";
    const sb = b.specialty ?? "";
    if (sa !== sb) return sa.localeCompare(sb, "zh");
    return a.name.localeCompare(b.name, "zh");
  });

  // 检查重名（中文名作 username 必须唯一）
  const nameCount = new Map<string, number>();
  users.forEach((u) => nameCount.set(u.name, (nameCount.get(u.name) ?? 0) + 1));
  const dups = [...nameCount.entries()].filter(([, c]) => c > 1);
  if (dups.length > 0) {
    console.error("❌ 检测到重名，无法用姓名作用户名：", dups);
    process.exit(1);
  }

  console.log(`📝 准备处理 ${users.length} 个用户...`);
  const rows: RowOut[] = [];

  for (const u of users) {
    const plainPwd = pickPassword(u);
    const hashed = await bcrypt.hash(plainPwd, 10);

    await prisma.user.update({
      where: { id: u.id },
      data: {
        username: u.name, // 中文名作 username
        password: hashed,
      },
    });

    rows.push({
      姓名: u.name,
      角色: ROLE_LABEL[u.role] ?? u.role,
      专业: u.specialty ?? "",
      职位: u.position ?? "",
      登录用户名: u.name,
      登录密码: plainPwd,
    });
  }

  // 生成 Excel
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 }, // 姓名
    { wch: 12 }, // 角色
    { wch: 10 }, // 专业
    { wch: 22 }, // 职位
    { wch: 14 }, // 登录用户名
    { wch: 14 }, // 登录密码
  ];

  // 行 1（表头）加粗
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "DBEAFE" } },
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "登录信息");

  // 第二个 sheet：分组统计
  const summary = [
    { 角色: "管理员", 人数: rows.filter((r) => r.角色 === "管理员").length },
    { 角色: "项目负责人", 人数: rows.filter((r) => r.角色 === "项目负责人").length },
    { 角色: "普通员工", 人数: rows.filter((r) => r.角色 === "普通员工").length },
    { 角色: "合计", 人数: rows.length },
  ];
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 14 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, "角色统计");

  const out = "docs/筑管登录账号清单.xlsx";
  XLSX.writeFile(wb, out);

  console.log("");
  console.log(`✅ ${out} 已生成`);
  console.log(`   ${rows.length} 个用户已更新`);
  console.log(`   管理员：${summary[0].人数} 人`);
  console.log(`   项目负责人：${summary[1].人数} 人`);
  console.log(`   普通员工：${summary[2].人数} 人`);
  console.log("");
  console.log("⚠️  线上数据库需要单独跑：");
  console.log('   DATABASE_URL="postgresql://...线上..." npx tsx prisma/setup-credentials.ts');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
