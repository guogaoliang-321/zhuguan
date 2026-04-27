import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { canViewAllWorkload } from "@/lib/permissions";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  parseISO,
  isValid,
  differenceInCalendarDays,
} from "date-fns";

export interface ProjectTimeline {
  projectId: string;
  projectName: string;
  phase: string;
  status: string;
  role: string;
  isLead: boolean;
  startDate: string | null;
  endDate: string | null;
  milestones: TimelineMilestone[];
}

export interface TimelineMilestone {
  id: string;
  name: string;
  dueDate: string;
  isCompleted: boolean;
  completedAt: string | null;
  phase: string;
}

export interface PersonWorkLog {
  id: string;
  date: string;
  hours: number;
  content: string;
  category: string | null;
  projectId: string;
  projectName: string;
}

export interface PersonBoardItem {
  userId: string;
  name: string;
  position: string | null;
  department: string | null;
  weeklyCapacity: number;
  projectTimelines: ProjectTimeline[];
  lastWeekLogs: PersonWorkLog[];
  thisWeekLogs: PersonWorkLog[];
  lastWeekHours: number;
  thisWeekHours: number;
  overdueCount: number;
  /** 按 from/to 聚合的总工时 */
  rangeHours: number;
  /** 按 from/to 聚合的饱和度（%） */
  rangeSaturation: number;
  /** 按 from/to 聚合的工作记录（最多 30 条） */
  rangeLogs: PersonWorkLog[];
  /** 按 from/to 聚合的按类别工时 */
  byCategory: { category: string; hours: number }[];
}

export interface PeopleBoardResponse {
  rangePreset: string;
  from: string;
  to: string;
  items: PersonBoardItem[];
}

type RangePreset = "this-week" | "this-month" | "this-quarter" | "last-30" | "custom";

function resolveRange(
  preset: string | null,
  fromParam: string | null,
  toParam: string | null
): { from: Date; to: Date; preset: string } {
  const now = new Date();
  if (fromParam && toParam) {
    const from = parseISO(fromParam);
    const to = parseISO(toParam);
    if (isValid(from) && isValid(to)) {
      return { from, to, preset: "custom" };
    }
  }
  switch (preset as RangePreset) {
    case "this-week": {
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
        preset: "this-week",
      };
    }
    case "this-quarter": {
      return {
        from: startOfQuarter(now),
        to: endOfQuarter(now),
        preset: "this-quarter",
      };
    }
    case "last-30": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from, to: now, preset: "last-30" };
    }
    case "this-month":
    default: {
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        preset: "this-month",
      };
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  // TODO 阶段6 可扩展 PROJECT_LEAD 看下属：当前仅 ADMIN
  if (!canViewAllWorkload(session.user)) return forbidden();

  const params = req.nextUrl.searchParams;
  const { from, to, preset } = resolveRange(
    params.get("range"),
    params.get("from"),
    params.get("to")
  );

  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  // 对于工作记录的查询取 [min(from, lastWeekStart), max(to, thisWeekEnd)] 的并集
  const logFrom = from < lastWeekStart ? from : lastWeekStart;
  const logTo = to > thisWeekEnd ? to : thisWeekEnd;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      position: true,
      department: true,
      weeklyCapacity: true,
      projectMembers: {
        where: { project: { status: { in: ["ACTIVE", "PAUSED"] } } },
        select: {
          role: true,
          project: {
            select: {
              id: true,
              name: true,
              phase: true,
              status: true,
              leadId: true,
              startDate: true,
              endDate: true,
              milestones: {
                select: {
                  id: true,
                  name: true,
                  dueDate: true,
                  isCompleted: true,
                  completedAt: true,
                  phase: true,
                },
                orderBy: { dueDate: "asc" },
              },
            },
          },
        },
      },
      ledProjects: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        select: {
          id: true,
          name: true,
          phase: true,
          status: true,
          leadId: true,
          startDate: true,
          endDate: true,
          milestones: {
            select: {
              id: true,
              name: true,
              dueDate: true,
              isCompleted: true,
              completedAt: true,
              phase: true,
            },
            orderBy: { dueDate: "asc" },
          },
        },
      },
      workLogs: {
        where: { date: { gte: logFrom, lte: logTo } },
        select: {
          id: true,
          date: true,
          hours: true,
          content: true,
          category: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // 计算范围内的期望工时（粗估：天数 / 7 × weeklyCapacity）
  const rangeDays = Math.max(1, differenceInCalendarDays(to, from) + 1);

  const items: PersonBoardItem[] = users.map((u) => {
    const projectMap = new Map<string, ProjectTimeline>();

    for (const pm of u.projectMembers) {
      const p = pm.project;
      projectMap.set(p.id, {
        projectId: p.id,
        projectName: p.name,
        phase: p.phase,
        status: p.status,
        role: pm.role,
        isLead: p.leadId === u.id,
        startDate: p.startDate?.toISOString() ?? null,
        endDate: p.endDate?.toISOString() ?? null,
        milestones: p.milestones.map((ms) => ({
          id: ms.id,
          name: ms.name,
          dueDate: ms.dueDate.toISOString(),
          isCompleted: ms.isCompleted,
          completedAt: ms.completedAt?.toISOString() ?? null,
          phase: ms.phase,
        })),
      });
    }

    for (const lp of u.ledProjects) {
      if (!projectMap.has(lp.id)) {
        projectMap.set(lp.id, {
          projectId: lp.id,
          projectName: lp.name,
          phase: lp.phase,
          status: lp.status,
          role: "项目负责人",
          isLead: true,
          startDate: lp.startDate?.toISOString() ?? null,
          endDate: lp.endDate?.toISOString() ?? null,
          milestones: lp.milestones.map((ms) => ({
            id: ms.id,
            name: ms.name,
            dueDate: ms.dueDate.toISOString(),
            isCompleted: ms.isCompleted,
            completedAt: ms.completedAt?.toISOString() ?? null,
            phase: ms.phase,
          })),
        });
      }
    }

    const lastWeekLogs: PersonWorkLog[] = [];
    const thisWeekLogs: PersonWorkLog[] = [];
    const rangeLogs: PersonWorkLog[] = [];
    const categoryMap = new Map<string, number>();
    let lastWeekHours = 0;
    let thisWeekHours = 0;
    let rangeHours = 0;

    for (const log of u.workLogs) {
      const logDate = new Date(log.date);
      const hours = log.hours ? Number(log.hours) : 0;
      const entry: PersonWorkLog = {
        id: log.id,
        date: log.date.toISOString(),
        hours,
        content: log.content,
        category: log.category,
        projectId: log.projectId ?? "",
        projectName: log.project?.name ?? "非项目任务",
      };

      if (logDate >= lastWeekStart && logDate <= lastWeekEnd) {
        lastWeekLogs.push(entry);
        lastWeekHours += hours;
      }
      if (logDate >= thisWeekStart && logDate <= thisWeekEnd) {
        thisWeekLogs.push(entry);
        thisWeekHours += hours;
      }
      if (logDate >= from && logDate <= to) {
        rangeLogs.push(entry);
        rangeHours += hours;
        const cat = log.category ?? "未分类";
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + hours);
      }
    }

    let overdueCount = 0;
    for (const pt of projectMap.values()) {
      for (const ms of pt.milestones) {
        if (!ms.isCompleted && new Date(ms.dueDate) < now) {
          overdueCount++;
        }
      }
    }

    const weeklyCapacity = Number(u.weeklyCapacity);
    const expectedHours = (rangeDays / 7) * weeklyCapacity;
    const saturation =
      expectedHours > 0 ? Math.round((rangeHours / expectedHours) * 100) : 0;

    const byCategory = Array.from(categoryMap, ([category, hours]) => ({
      category,
      hours: Math.round(hours * 10) / 10,
    })).sort((a, b) => b.hours - a.hours);

    return {
      userId: u.id,
      name: u.name,
      position: u.position,
      department: u.department,
      weeklyCapacity,
      projectTimelines: Array.from(projectMap.values()),
      lastWeekLogs,
      thisWeekLogs,
      lastWeekHours: Math.round(lastWeekHours * 10) / 10,
      thisWeekHours: Math.round(thisWeekHours * 10) / 10,
      overdueCount,
      rangeHours: Math.round(rangeHours * 10) / 10,
      rangeSaturation: saturation,
      rangeLogs: rangeLogs.slice(0, 30),
      byCategory,
    };
  });

  const response: PeopleBoardResponse = {
    rangePreset: preset,
    from: from.toISOString(),
    to: to.toISOString(),
    items,
  };

  return NextResponse.json(response);
}
