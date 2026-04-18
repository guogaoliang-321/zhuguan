import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, badRequest } from "@/lib/api-utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  parse,
  isValid,
  format,
} from "date-fns";

export interface MineSummary {
  month: string; // YYYY-MM
  totalHours: number;
  daysLogged: number;
  logCount: number;
  byProject: { projectId: string; projectName: string; hours: number }[];
  byCategory: { category: string; hours: number }[];
  byWeek: { weekStart: string; weekEnd: string; hours: number }[];
  recentLogs: {
    id: string;
    date: string;
    hours: number;
    content: string;
    category: string | null;
    projectId: string;
    projectName: string;
  }[];
  /** 本周是否已填工时（未填 → 提示补录） */
  thisWeekFilled: boolean;
}

function parseMonth(value: string | null): Date {
  if (!value) return new Date();
  const d = parse(value, "yyyy-MM", new Date());
  return isValid(d) ? d : new Date();
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const monthParam = req.nextUrl.searchParams.get("month");
  const base = parseMonth(monthParam);
  const from = startOfMonth(base);
  const to = endOfMonth(base);

  if (!isValid(from) || !isValid(to)) {
    return badRequest("month 参数格式错误，应为 YYYY-MM");
  }

  const userId = session.user.id;

  const logs = await prisma.workLog.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hours: true,
      content: true,
      category: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  let totalHours = 0;
  const projectMap = new Map<string, { projectName: string; hours: number }>();
  const categoryMap = new Map<string, number>();
  const dayKeys = new Set<string>();

  for (const l of logs) {
    const h = l.hours ? Number(l.hours) : 0;
    totalHours += h;
    const existing = projectMap.get(l.projectId);
    if (existing) existing.hours += h;
    else projectMap.set(l.projectId, { projectName: l.project.name, hours: h });

    const cat = l.category ?? "未分类";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + h);
    dayKeys.add(format(l.date, "yyyy-MM-dd"));
  }

  const byProject = Array.from(projectMap, ([projectId, v]) => ({
    projectId,
    projectName: v.projectName,
    hours: Math.round(v.hours * 10) / 10,
  }))
    .sort((a, b) => b.hours - a.hours);

  const byCategory = Array.from(categoryMap, ([category, hours]) => ({
    category,
    hours: Math.round(hours * 10) / 10,
  })).sort((a, b) => b.hours - a.hours);

  // 按周聚合
  const weeks = eachWeekOfInterval(
    { start: from, end: to },
    { weekStartsOn: 1 }
  );
  const byWeek = weeks.map((weekStart) => {
    const ws = startOfWeek(weekStart, { weekStartsOn: 1 });
    const we = endOfWeek(weekStart, { weekStartsOn: 1 });
    const hours = logs.reduce((sum, l) => {
      if (l.date >= ws && l.date <= we) {
        return sum + (l.hours ? Number(l.hours) : 0);
      }
      return sum;
    }, 0);
    return {
      weekStart: ws.toISOString(),
      weekEnd: we.toISOString(),
      hours: Math.round(hours * 10) / 10,
    };
  });

  // 本周是否填过（仅当 month 是当前月时有意义，不是也返回）
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeekLogs = await prisma.workLog.count({
    where: {
      userId,
      date: { gte: thisWeekStart, lte: thisWeekEnd },
    },
  });

  const recentLogs = logs.slice(0, 20).map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    hours: l.hours ? Number(l.hours) : 0,
    content: l.content,
    category: l.category,
    projectId: l.projectId,
    projectName: l.project.name,
  }));

  const summary: MineSummary = {
    month: format(base, "yyyy-MM"),
    totalHours: Math.round(totalHours * 10) / 10,
    daysLogged: dayKeys.size,
    logCount: logs.length,
    byProject,
    byCategory,
    byWeek,
    recentLogs,
    thisWeekFilled: thisWeekLogs > 0,
  };

  return NextResponse.json(summary);
}
