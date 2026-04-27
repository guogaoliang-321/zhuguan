import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { canViewAllWeekly } from "@/lib/permissions";
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

  // TODO 阶段4: PROJECT_LEAD 可看自己负责项目成员的周报；当前仅 ADMIN
  if (!canViewAllWeekly(session.user)) return forbidden();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const logs = await prisma.workLog.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
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
