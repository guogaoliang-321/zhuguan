/**
 * 一次性 API：清空所有业务数据，但保留用户
 *
 * 调用：POST /api/admin/purge-data?secret=<NEXTAUTH_SECRET>
 *
 * 删除：
 *   - WorkLog
 *   - TaskStatusLog
 *   - Task
 *   - Milestone
 *   - ProjectNote
 *   - ProjectMember
 *   - Project
 *   - Notification
 *   - Appeal
 *   - NonProjectCategory（用户自建的）
 *
 * 保留：User
 *
 * 用完即可从 middleware 排除列表里删除，并把这个文件删掉。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 按外键依赖顺序删除（子表 → 父表）
  // 同一事务内执行，保证全或全不
  const result = await prisma.$transaction(async (tx) => {
    const wl = await tx.workLog.deleteMany({});
    const tsl = await tx.taskStatusLog.deleteMany({});
    const tk = await tx.task.deleteMany({});
    const ms = await tx.milestone.deleteMany({});
    const pn = await tx.projectNote.deleteMany({});
    const pm = await tx.projectMember.deleteMany({});
    const pj = await tx.project.deleteMany({});
    const nf = await tx.notification.deleteMany({});
    const ap = await tx.appeal.deleteMany({});
    const npc = await tx.nonProjectCategory.deleteMany({});

    return {
      workLogs: wl.count,
      taskStatusLogs: tsl.count,
      tasks: tk.count,
      milestones: ms.count,
      projectNotes: pn.count,
      projectMembers: pm.count,
      projects: pj.count,
      notifications: nf.count,
      appeals: ap.count,
      nonProjectCategories: npc.count,
    };
  });

  const userCount = await prisma.user.count({ where: { isActive: true } });

  return NextResponse.json({
    deleted: result,
    activeUsersRemaining: userCount,
  });
}
