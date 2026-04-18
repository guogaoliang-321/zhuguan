import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized } from "@/lib/api-utils";
import { projectVisibilityFilter } from "@/lib/permissions";

export interface ActivityItem {
  id: string;
  type: "note" | "worklog" | "milestone";
  time: string;
  userName: string;
  projectId: string;
  projectName: string;
  content: string;
  extra?: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const limitParam = req.nextUrl.searchParams.get("limit");
  const parsed = limitParam ? Number.parseInt(limitParam, 10) : 60;
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 60;

  const perKind = Math.max(Math.ceil(limit / 2), 20);
  const visibility = projectVisibilityFilter(session.user);

  const [notes, logs, milestones] = await Promise.all([
    prisma.projectNote.findMany({
      where: { project: visibility },
      take: perKind,
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
      take: perKind,
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
      take: perKind,
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

  const activities: ActivityItem[] = [
    ...notes.map((n) => ({
      id: `note-${n.id}`,
      type: "note" as const,
      time: n.createdAt.toISOString(),
      userName: n.author.name,
      projectId: n.project.id,
      projectName: n.project.name,
      content: n.content,
    })),
    ...logs.map((l) => ({
      id: `log-${l.id}`,
      type: "worklog" as const,
      time: l.createdAt.toISOString(),
      userName: l.user.name,
      projectId: l.project.id,
      projectName: l.project.name,
      content: l.content,
      extra: `${l.hours ? Number(l.hours) : 0}h${l.category ? ` · ${l.category}` : ""}`,
    })),
    ...milestones.map((m) => ({
      id: `ms-${m.id}`,
      type: "milestone" as const,
      time: (m.completedAt ?? new Date()).toISOString(),
      userName: m.assignee?.name ?? "-",
      projectId: m.project.id,
      projectName: m.project.name,
      content: `完成节点「${m.name}」`,
    })),
  ];

  activities.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );

  return NextResponse.json({ activities: activities.slice(0, limit) });
}
