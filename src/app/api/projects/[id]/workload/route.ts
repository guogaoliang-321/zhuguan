import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  unauthorized,
  notFound,
  forbidden,
} from "@/lib/api-utils";
import { canViewProject } from "@/lib/permissions";

export interface ProjectWorkloadMember {
  userId: string;
  name: string;
  position: string | null;
  role: string;
  isLead: boolean;
  totalHours: number;
  byCategory: { category: string; hours: number }[];
  logCount: number;
}

export interface ProjectWorkloadResponse {
  totalHours: number;
  logCount: number;
  members: ProjectWorkloadMember[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      leadId: true,
      lead: { select: { id: true, name: true, position: true } },
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, position: true } },
        },
      },
    },
  });
  if (!project) return notFound("项目不存在");

  if (
    !canViewProject(session.user, {
      leadId: project.leadId,
      members: project.members.map((m) => ({ userId: m.user.id })),
    })
  ) {
    return forbidden();
  }

  const logs = await prisma.workLog.findMany({
    where: { projectId: id },
    select: {
      userId: true,
      hours: true,
      category: true,
    },
  });

  // 先构造成员列表（含 lead + members，去重）
  const userMap = new Map<
    string,
    {
      userId: string;
      name: string;
      position: string | null;
      role: string;
      isLead: boolean;
      totalHours: number;
      logCount: number;
      categoryMap: Map<string, number>;
    }
  >();

  userMap.set(project.lead.id, {
    userId: project.lead.id,
    name: project.lead.name,
    position: project.lead.position,
    role: "项目负责人",
    isLead: true,
    totalHours: 0,
    logCount: 0,
    categoryMap: new Map(),
  });

  for (const m of project.members) {
    if (!userMap.has(m.user.id)) {
      userMap.set(m.user.id, {
        userId: m.user.id,
        name: m.user.name,
        position: m.user.position,
        role: m.role,
        isLead: false,
        totalHours: 0,
        logCount: 0,
        categoryMap: new Map(),
      });
    }
  }

  let totalHours = 0;

  for (const log of logs) {
    const hours = log.hours ? Number(log.hours) : 0;
    totalHours += hours;

    let entry = userMap.get(log.userId);
    if (!entry) {
      // 离职或已移除但有历史记录的人
      entry = {
        userId: log.userId,
        name: "（已离开）",
        position: null,
        role: "历史记录",
        isLead: false,
        totalHours: 0,
        logCount: 0,
        categoryMap: new Map(),
      };
      userMap.set(log.userId, entry);
    }

    entry.totalHours += hours;
    entry.logCount += 1;
    const cat = log.category ?? "未分类";
    entry.categoryMap.set(cat, (entry.categoryMap.get(cat) ?? 0) + hours);
  }

  const members: ProjectWorkloadMember[] = Array.from(userMap.values())
    .map((m) => ({
      userId: m.userId,
      name: m.name,
      position: m.position,
      role: m.role,
      isLead: m.isLead,
      totalHours: Math.round(m.totalHours * 10) / 10,
      logCount: m.logCount,
      byCategory: Array.from(m.categoryMap, ([category, hours]) => ({
        category,
        hours: Math.round(hours * 10) / 10,
      })).sort((a, b) => b.hours - a.hours),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const response: ProjectWorkloadResponse = {
    totalHours: Math.round(totalHours * 10) / 10,
    logCount: logs.length,
    members,
  };

  return NextResponse.json(response);
}
