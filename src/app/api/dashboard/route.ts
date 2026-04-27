import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized } from "@/lib/api-utils";
import { projectVisibilityFilter } from "@/lib/permissions";
import { startOfWeek, endOfWeek } from "date-fns";

export type TrafficLight = "green" | "yellow" | "red" | "gray";

export interface DashboardProject {
  id: string;
  name: string;
  contractNo: string | null;
  contractAmount: number | null;
  clientName: string;
  projectType: string | null;
  phase: string;
  status: string;
  lead: { id: string; name: string };
  light: TrafficLight;
  progress: number;
  nearestMilestone: {
    name: string;
    dueDate: string;
    isCompleted: boolean;
  } | null;
  memberCount: number;
  milestoneStats: { total: number; completed: number };
}

export interface DashboardStats {
  total: number;
  active: number;
  green: number;
  yellow: number;
  red: number;
  dueThisWeek: number;
}

export interface DashboardMe {
  thisWeekHours: number;
  thisWeekFilled: boolean;
}

function calculateLight(
  milestones: { dueDate: Date; isCompleted: boolean }[],
  status: string
): TrafficLight {
  if (status === "PAUSED" || status === "ARCHIVED") return "gray";

  const incomplete = milestones.filter((m) => !m.isCompleted);
  if (incomplete.length === 0) return "gray";

  const now = new Date();
  const hasOverdue = incomplete.some((m) => m.dueDate < now);
  if (hasOverdue) return "red";

  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const hasSoon = incomplete.some((m) => m.dueDate <= threeDays);
  if (hasSoon) return "yellow";

  return "green";
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const visibility = projectVisibilityFilter(session.user);
  const projects = await prisma.project.findMany({
    where: { AND: [visibility, { status: { not: "ARCHIVED" } }] },
    include: {
      lead: { select: { id: true, name: true } },
      milestones: {
        select: { name: true, dueDate: true, isCompleted: true },
        orderBy: { dueDate: "asc" },
      },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  let dueThisWeek = 0;

  const dashboardProjects: DashboardProject[] = projects.map((p) => {
    const light = calculateLight(p.milestones, p.status);

    if (light === "green") greenCount++;
    else if (light === "yellow") yellowCount++;
    else if (light === "red") redCount++;

    const total = p.milestones.length;
    const completed = p.milestones.filter((m) => m.isCompleted).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const nearestIncomplete = p.milestones.find((m) => !m.isCompleted);

    if (nearestIncomplete && nearestIncomplete.dueDate <= weekEnd) {
      dueThisWeek++;
    }

    return {
      id: p.id,
      name: p.name,
      contractNo: p.contractNo,
      contractAmount: p.contractAmount ? Number(p.contractAmount) : null,
      clientName: p.clientName,
      projectType: p.projectType,
      phase: p.phase,
      status: p.status,
      lead: p.lead,
      light,
      progress,
      nearestMilestone: nearestIncomplete
        ? {
            name: nearestIncomplete.name,
            dueDate: nearestIncomplete.dueDate.toISOString(),
            isCompleted: false,
          }
        : null,
      memberCount: p._count.members,
      milestoneStats: { total, completed },
    };
  });

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;

  const stats: DashboardStats = {
    total: projects.length,
    active: activeCount,
    green: greenCount,
    yellow: yellowCount,
    red: redCount,
    dueThisWeek,
  };

  // 最新项目动态：备注 + 工作记录 + 已完成里程碑，混合按时间倒序
  // 按 projectVisibilityFilter 过滤，普通员工只看自己参与项目的动态
  const [recentNotes, recentLogs, recentMilestones] = await Promise.all([
    prisma.projectNote.findMany({
      where: { project: visibility },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.workLog.findMany({
      where: { project: visibility },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        hours: true,
        category: true,
        createdAt: true,
        user: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.milestone.findMany({
      where: { AND: [{ isCompleted: true }, { project: visibility }] },
      take: 4,
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        name: true,
        completedAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { name: true } },
      },
    }),
  ]);

  type ActivityItem = {
    id: string;
    type: "note" | "worklog" | "milestone";
    time: string;
    userName: string;
    projectId: string;
    projectName: string;
    content: string;
    extra?: string;
  };

  const activities: ActivityItem[] = [
    ...recentNotes.map((n) => ({
      id: `note-${n.id}`,
      type: "note" as const,
      time: n.createdAt.toISOString(),
      userName: n.author.name,
      projectId: n.project.id,
      projectName: n.project.name,
      content: n.content,
    })),
    ...recentLogs
      .filter((l) => l.project != null)
      .map((l) => ({
        id: `log-${l.id}`,
        type: "worklog" as const,
        time: l.createdAt.toISOString(),
        userName: l.user.name,
        projectId: l.project!.id,
        projectName: l.project!.name,
        content: l.content,
        extra: `${l.hours ? Number(l.hours) : 0}h${l.category ? ` · ${l.category}` : ""}`,
      })),
    ...recentMilestones.map((m) => ({
      id: `ms-${m.id}`,
      type: "milestone" as const,
      time: (m.completedAt ?? new Date()).toISOString(),
      userName: m.assignee?.name ?? "-",
      projectId: m.project.id,
      projectName: m.project.name,
      content: `完成节点「${m.name}」`,
    })),
  ];

  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // 当前用户本周工时
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const myWeekLogs = await prisma.workLog.findMany({
    where: {
      userId: session.user.id,
      date: { gte: thisWeekStart, lte: thisWeekEnd },
    },
    select: { hours: true },
  });
  const thisWeekHours = myWeekLogs.reduce(
    (sum, l) => sum + (l.hours ? Number(l.hours) : 0),
    0
  );

  const me: DashboardMe = {
    thisWeekHours: Math.round(thisWeekHours * 10) / 10,
    thisWeekFilled: myWeekLogs.length > 0,
  };

  return NextResponse.json({
    projects: dashboardProjects,
    stats,
    me,
    recentActivities: activities.slice(0, 8),
  });
}
