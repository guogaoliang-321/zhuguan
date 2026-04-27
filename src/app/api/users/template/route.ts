import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { canManageUsers } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.user)) return forbidden();

  const data = [
    ["姓名", "手机", "身份证号", "角色", "专业", "备注"],
    ["张三", "13800138000", "610101199001011234", "普通员工", "建筑", ""],
    ["李四", "13900139000", "610101199001011235", "项目负责人", "结构", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "用户导入模板");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="user_import_template.xlsx"',
    },
  });
}
