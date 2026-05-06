import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized } from "@/lib/api-utils";
import {
  canViewWeeklyBoard,
  isAdmin,
  isProjectLead,
} from "@/lib/permissions";
import { startOfWeek, endOfWeek } from "date-fns";

export interface WeeklyEntry {
  userId: string;
  name: string;
  logs: {
    id: string;
    date: string;
    hours: number;
    content: string;
    category: string | null;
    projectName: string;
  }[];
  totalHours: number;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewWeeklyBoard(session.user)) return unauthorized();

  const me = session.user;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // 计算可见用户范围
  // ADMIN：全部
  // PM：自己 + 自己负责项目里的所有成员
  // MEMBER：仅自己（队友周报隐去明细，避免暴露工时内容）
  let visibleUserIds: Set<string> | null = null;
  if (!isAdmin(me)) {
    const ids = new Set<string>([me.id]);
    if (isProjectLead(me)) {
      const ledProjects = await prisma.project.findMany({
        where: { leadId: me.id },
        select: { members: { select: { userId: true } } },
      });
      for (const p of ledProjects) for (const m of p.members) ids.add(m.userId);
    }
    visibleUserIds = ids;
  }

  const logs = await prisma.workLog.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      ...(visibleUserIds ? { userId: { in: [...visibleUserIds] } } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ userId: "asc" }, { date: "desc" }],
  });

  const grouped = new Map<string, WeeklyEntry>();

  for (const log of logs) {
    const key = log.userId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        userId: log.user.id,
        name: log.user.name,
        logs: [],
        totalHours: 0,
      });
    }
    const entry = grouped.get(key)!;
    const hours = log.hours ? Number(log.hours) : 0;
    entry.logs.push({
      id: log.id,
      date: log.date.toISOString(),
      hours,
      content: log.content,
      category: log.category,
      projectName: log.project?.name ?? "非项目任务",
    });
    entry.totalHours += hours;
  }

  return NextResponse.json(Array.from(grouped.values()));
}
