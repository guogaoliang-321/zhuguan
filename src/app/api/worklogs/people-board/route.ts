import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { canViewAllWorkload } from "@/lib/permissions";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

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
  projectTimelines: ProjectTimeline[];
  lastWeekLogs: PersonWorkLog[];
  thisWeekLogs: PersonWorkLog[];
  lastWeekHours: number;
  thisWeekHours: number;
  overdueCount: number;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  // TODO 阶段4: PROJECT_LEAD 可看自己负责项目的成员；当前仅 ADMIN
  if (!canViewAllWorkload(session.user)) return forbidden();

  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      position: true,
      department: true,
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
        where: { date: { gte: lastWeekStart, lte: thisWeekEnd } },
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

  const items: PersonBoardItem[] = users.map((u) => {
    // 合并项目去重，带时间线
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
    let lastWeekHours = 0;
    let thisWeekHours = 0;

    for (const log of u.workLogs) {
      const logDate = new Date(log.date);
      const hours = log.hours ? Number(log.hours) : 0;
      const entry: PersonWorkLog = {
        id: log.id,
        date: log.date.toISOString(),
        hours,
        content: log.content,
        category: log.category,
        projectId: log.projectId,
        projectName: log.project.name,
      };

      if (logDate >= lastWeekStart && logDate <= lastWeekEnd) {
        lastWeekLogs.push(entry);
        lastWeekHours += hours;
      } else if (logDate >= thisWeekStart && logDate <= thisWeekEnd) {
        thisWeekLogs.push(entry);
        thisWeekHours += hours;
      }
    }

    // 逾期节点统计
    let overdueCount = 0;
    for (const pt of projectMap.values()) {
      for (const ms of pt.milestones) {
        if (!ms.isCompleted && new Date(ms.dueDate) < now) {
          overdueCount++;
        }
      }
    }

    return {
      userId: u.id,
      name: u.name,
      position: u.position,
      department: u.department,
      projectTimelines: Array.from(projectMap.values()),
      lastWeekLogs,
      thisWeekLogs,
      lastWeekHours,
      thisWeekHours,
      overdueCount,
    };
  });

  return NextResponse.json(items);
}
