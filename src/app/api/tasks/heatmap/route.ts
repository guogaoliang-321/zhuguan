import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { canViewTeamHeatmap, type SessionUser } from "@/lib/permissions";
import { refreshOverdueTasks } from "@/lib/task-helpers";

/**
 * GET /api/tasks/heatmap?weeks=4
 *
 * 返回未来 N 周（默认 4 周）每人每周的预估工时与饱和度。
 * 权限：ADMIN + PROJECT_LEAD
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = session.user as SessionUser;
  if (!canViewTeamHeatmap(user)) return forbidden();

  await refreshOverdueTasks();

  const weeks = Math.max(1, Math.min(12, Number(request.nextUrl.searchParams.get("weeks") ?? 4)));

  // 计算未来 N 周的起止：本周一 00:00 到第 N 周日 23:59
  const today = new Date();
  const day = today.getDay() || 7; // 周日 → 7
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - day + 1);

  const horizonEnd = new Date(monday);
  horizonEnd.setDate(monday.getDate() + 7 * weeks);

  // 拉所有相关任务（plannedStart < horizonEnd 且 plannedEnd > monday 且未完成）
  const tasks = await prisma.task.findMany({
    where: {
      plannedStart: { lt: horizonEnd },
      plannedEnd: { gt: monday },
      status: { in: ["pending", "in_progress", "overdue"] },
    },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          specialty: true,
          weeklyCapacity: true,
        },
      },
    },
  });

  // 按用户和周分桶（这周第一天作为 key）
  type Cell = { weekStart: string; estimatedHours: number; taskIds: string[] };
  type Row = {
    userId: string;
    name: string;
    specialty: string | null;
    weeklyCapacity: number;
    cells: Cell[];
  };

  const weekKeys: string[] = [];
  for (let w = 0; w < weeks; w++) {
    const ws = new Date(monday);
    ws.setDate(monday.getDate() + 7 * w);
    weekKeys.push(ws.toISOString());
  }

  const rowMap = new Map<string, Row>();

  for (const t of tasks) {
    const cap = Number(t.assignee.weeklyCapacity ?? 40);
    if (!rowMap.has(t.assigneeId)) {
      rowMap.set(t.assigneeId, {
        userId: t.assigneeId,
        name: t.assignee.name,
        specialty: t.assignee.specialty ?? null,
        weeklyCapacity: cap,
        cells: weekKeys.map((k) => ({ weekStart: k, estimatedHours: 0, taskIds: [] })),
      });
    }
    const row = rowMap.get(t.assigneeId)!;
    const taskHours = Number(t.estimatedHours);
    const taskMs = t.plannedEnd.getTime() - t.plannedStart.getTime();
    if (taskMs <= 0) continue;
    const hoursPerMs = taskHours / taskMs;

    // 把工时按时间长度比例分配到与每周区间相交的部分
    for (let w = 0; w < weeks; w++) {
      const ws = new Date(weekKeys[w]);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 7);
      const overlapStart = Math.max(t.plannedStart.getTime(), ws.getTime());
      const overlapEnd = Math.min(t.plannedEnd.getTime(), we.getTime());
      if (overlapEnd > overlapStart) {
        row.cells[w].estimatedHours += (overlapEnd - overlapStart) * hoursPerMs;
        row.cells[w].taskIds.push(t.id);
      }
    }
  }

  const rows = Array.from(rowMap.values()).map((r) => ({
    ...r,
    cells: r.cells.map((c) => ({
      ...c,
      estimatedHours: Math.round(c.estimatedHours * 10) / 10,
      utilization:
        r.weeklyCapacity > 0
          ? Math.round((c.estimatedHours / r.weeklyCapacity) * 100)
          : 0,
    })),
  }));

  // 按专业分组排序
  rows.sort((a, b) => {
    const sa = a.specialty ?? "";
    const sb = b.specialty ?? "";
    if (sa !== sb) return sa.localeCompare(sb, "zh");
    return a.name.localeCompare(b.name, "zh");
  });

  return NextResponse.json({
    weekStarts: weekKeys,
    rows,
  });
}
