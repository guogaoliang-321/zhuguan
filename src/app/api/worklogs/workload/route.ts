import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { canViewAllWorkload } from "@/lib/permissions";
import { startOfWeek, endOfWeek } from "date-fns";

export type WorkloadTag = "idle" | "normal" | "busy";

export interface WorkloadItem {
  userId: string;
  name: string;
  position: string | null;
  department: string | null;
  projectCount: number;
  weeklyHours: number;
  tag: WorkloadTag;
}

function calculateTag(hours: number, projects: number): WorkloadTag {
  if (hours > 40 || projects > 4) return "busy";
  if (hours < 20 && projects < 2) return "idle";
  return "normal";
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  // TODO 阶段4: PROJECT_LEAD 可看自己负责项目的成员；当前仅 ADMIN
  if (!canViewAllWorkload(session.user)) return forbidden();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      position: true,
      department: true,
      projectMembers: {
        select: { projectId: true },
        where: {
          project: { status: "ACTIVE" },
        },
      },
      workLogs: {
        where: {
          date: { gte: weekStart, lte: weekEnd },
        },
        select: { hours: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const items: WorkloadItem[] = users.map((u) => {
    const weeklyHours = u.workLogs.reduce(
      (sum, l) => sum + (l.hours ? Number(l.hours) : 0),
      0
    );
    const projectCount = u.projectMembers.length;
    return {
      userId: u.id,
      name: u.name,
      position: u.position,
      department: u.department,
      projectCount,
      weeklyHours,
      tag: calculateTag(weeklyHours, projectCount),
    };
  });

  return NextResponse.json(items);
}
