/**
 * 异常规则扫描器（lazy 触发）
 *
 * 4 条规则：
 *   R1 · 任务延期 > 24h：通知责任人 + PM
 *   R2 · 责任人连续 3 天有任务未"每日确认"：通知本人 + PM
 *   R3 · 个人本周饱和度 > 110%（基于未来 7 天派工累加）：通知 PM + ADMIN
 *   R4 · 任务被多次插队（同责任人 ≥ 3 次顺延）：通知 ADMIN
 *
 * 设计原则：
 *  - 幂等：以 (userId, type, dedupeKey) 一组在 24h 内只发一条
 *  - lazy：在 dashboard / notifications 页面访问时调用，不依赖 cron
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { sendFeishuMessage } from "@/lib/feishu";

const DEDUP_HOURS = 24;

const FEISHU_COLOR_BY_TYPE: Record<string, "red" | "orange" | "blue"> = {
  task_overdue_24h: "red",
  not_confirmed_3d: "orange",
  overload: "orange",
  repeated_insertion: "red",
};

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  linkType?: string | null;
  linkId?: string | null;
  payload?: Prisma.InputJsonValue;
  /** 用于去重：相同 (userId, type, dedupeKey) 在 24h 内只发一条 */
  dedupeKey: string;
}

/** 写一条通知，但 24h 内同 (userId, type, dedupeKey) 已写过则跳过 */
async function notifyOnce(input: NotifyInput): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
  const dup = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      createdAt: { gte: since },
      AND: [
        // 通过 payload.dedupeKey 字段去重
        { payload: { path: ["dedupeKey"], equals: input.dedupeKey } },
      ],
    },
    select: { id: true },
  });
  if (dup) return false;

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      linkType: input.linkType ?? null,
      linkId: input.linkId ?? null,
      payload: {
        dedupeKey: input.dedupeKey,
        ...((input.payload as Prisma.JsonObject | undefined) ?? {}),
      },
    },
  });

  // 飞书推送（fire-and-forget，环境变量未配则静默跳过）
  void sendFeishuMessage({
    title: `[筑管] ${input.title}`,
    content: input.message,
    color: FEISHU_COLOR_BY_TYPE[input.type] ?? "blue",
  });

  return true;
}

/** 同一个项目的 lead，便于通知 PM */
async function getProjectLead(
  projectId: string | null
): Promise<{ id: string } | null> {
  if (!projectId) return null;
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { leadId: true },
  }).then((p) => (p ? { id: p.leadId } : null));
}

const ADMIN_CACHE: { ids: string[]; expiresAt: number } = {
  ids: [],
  expiresAt: 0,
};

async function getAdminIds(): Promise<string[]> {
  if (Date.now() < ADMIN_CACHE.expiresAt && ADMIN_CACHE.ids.length > 0) {
    return ADMIN_CACHE.ids;
  }
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  ADMIN_CACHE.ids = admins.map((a) => a.id);
  ADMIN_CACHE.expiresAt = Date.now() + 5 * 60 * 1000;
  return ADMIN_CACHE.ids;
}

/** R1 · 任务逾期超 24h */
async function scanOverdueTasks(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      status: "overdue",
      plannedEnd: { lt: cutoff },
    },
    select: { id: true, name: true, assigneeId: true, projectId: true },
  });
  let count = 0;
  for (const t of tasks) {
    const lead = await getProjectLead(t.projectId);
    const recipients = new Set<string>([t.assigneeId]);
    if (lead) recipients.add(lead.id);
    for (const rid of recipients) {
      const ok = await notifyOnce({
        userId: rid,
        type: "task_overdue_24h",
        title: "任务逾期超 24 小时",
        message: `《${t.name}》已逾期超 24 小时，请尽快处理或填写处理措施`,
        linkType: "task",
        linkId: t.id,
        dedupeKey: t.id,
      });
      if (ok) count++;
    }
  }
  return count;
}

/** R2 · 连续 3 天未确认任何今日任务 */
async function scanUnconfirmedThreeDays(): Promise<number> {
  // 找有任务在执行的人员
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);

  // 拉过去 3 天里"应该执行"的任务（plannedStart <= today, plannedEnd >= threeDaysAgo, 非 done）
  const tasks = await prisma.task.findMany({
    where: {
      plannedStart: { lte: today },
      plannedEnd: { gte: threeDaysAgo },
      status: { not: "done" },
    },
    select: {
      id: true,
      name: true,
      assigneeId: true,
      projectId: true,
      confirmedAt: true,
    },
  });

  // 按责任人分组，看其是否在过去 3 天里有任何 confirmedAt >= threeDaysAgo
  const byUser = new Map<string, { ids: string[]; lastConfirmed: Date | null }>();
  for (const t of tasks) {
    const cur = byUser.get(t.assigneeId) ?? { ids: [], lastConfirmed: null };
    cur.ids.push(t.id);
    if (t.confirmedAt && (!cur.lastConfirmed || t.confirmedAt > cur.lastConfirmed)) {
      cur.lastConfirmed = t.confirmedAt;
    }
    byUser.set(t.assigneeId, cur);
  }

  let count = 0;
  for (const [userId, info] of byUser) {
    const noConfirmIn3d =
      !info.lastConfirmed || info.lastConfirmed < threeDaysAgo;
    if (!noConfirmIn3d) continue;

    // 通知本人
    const ok1 = await notifyOnce({
      userId,
      type: "not_confirmed_3d",
      title: "你已 3 天没确认今日任务",
      message: `当前有 ${info.ids.length} 个任务待执行，请到 Dashboard 勾选"确认今日要做"`,
      linkType: null,
      linkId: null,
      dedupeKey: `${userId}-${today.toISOString().slice(0, 10)}`,
    });
    if (ok1) count++;

    // 通知该用户最常涉及的项目 PM（取第一个 task 的 lead）
    const firstTaskWithProj = tasks.find(
      (t) => t.assigneeId === userId && t.projectId
    );
    if (firstTaskWithProj?.projectId) {
      const lead = await getProjectLead(firstTaskWithProj.projectId);
      if (lead && lead.id !== userId) {
        const ok2 = await notifyOnce({
          userId: lead.id,
          type: "not_confirmed_3d",
          title: "成员 3 天未确认任务",
          message: `${info.ids.length} 个待执行任务的责任人最近 3 天没在系统确认`,
          linkType: null,
          linkId: null,
          dedupeKey: `pm-${userId}-${today.toISOString().slice(0, 10)}`,
        });
        if (ok2) count++;
      }
    }
  }
  return count;
}

/** R3 · 个人未来 7 天饱和度 > 110% */
async function scanOverloadedUsers(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const tasks = await prisma.task.findMany({
    where: {
      plannedStart: { lt: weekEnd },
      plannedEnd: { gt: today },
      status: { in: ["pending", "in_progress", "overdue"] },
    },
    select: {
      id: true,
      assigneeId: true,
      estimatedHours: true,
      plannedStart: true,
      plannedEnd: true,
      projectId: true,
      assignee: { select: { weeklyCapacity: true, name: true } },
    },
  });

  // 按用户聚合该周分摊工时
  const byUser = new Map<
    string,
    { hours: number; capacity: number; name: string; projectId: string | null }
  >();
  for (const t of tasks) {
    const taskMs = t.plannedEnd.getTime() - t.plannedStart.getTime();
    if (taskMs <= 0) continue;
    const hPerMs = Number(t.estimatedHours) / taskMs;
    const oS = Math.max(t.plannedStart.getTime(), today.getTime());
    const oE = Math.min(t.plannedEnd.getTime(), weekEnd.getTime());
    const overlapHours = Math.max(0, (oE - oS) * hPerMs);

    const cur = byUser.get(t.assigneeId) ?? {
      hours: 0,
      capacity: Number(t.assignee.weeklyCapacity ?? 40),
      name: t.assignee.name,
      projectId: t.projectId,
    };
    cur.hours += overlapHours;
    byUser.set(t.assigneeId, cur);
  }

  const adminIds = await getAdminIds();
  let count = 0;
  const dedupDate = today.toISOString().slice(0, 10);

  for (const [userId, info] of byUser) {
    const util = info.capacity > 0 ? (info.hours / info.capacity) * 100 : 0;
    if (util <= 110) continue;
    const utilRounded = Math.round(util);

    const recipients = new Set<string>(adminIds);
    const lead = await getProjectLead(info.projectId);
    if (lead) recipients.add(lead.id);

    for (const rid of recipients) {
      const ok = await notifyOnce({
        userId: rid,
        type: "overload",
        title: "成员负荷过载",
        message: `${info.name} 本周饱和度 ${utilRounded}%（${info.hours.toFixed(1)}h / ${info.capacity}h）`,
        payload: { targetUserId: userId, utilization: utilRounded },
        linkType: "project",
        linkId: info.projectId ?? undefined,
        dedupeKey: `${userId}-${dedupDate}`,
      });
      if (ok) count++;
    }
  }
  return count;
}

/** R4 · 同责任人有 ≥ 3 个插队任务尚未完成 */
async function scanRepeatedInsertions(): Promise<number> {
  const insertions = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: {
      isInsertion: true,
      status: { in: ["pending", "in_progress", "overdue"] },
    },
    _count: { _all: true },
  });

  const adminIds = await getAdminIds();
  const dedupDate = new Date().toISOString().slice(0, 10);
  let count = 0;
  for (const g of insertions) {
    if (g._count._all < 3) continue;
    for (const aid of adminIds) {
      const ok = await notifyOnce({
        userId: aid,
        type: "repeated_insertion",
        title: "插队任务过多",
        message: `有成员被插队 ${g._count._all} 个任务尚未消化`,
        payload: { assigneeId: g.assigneeId, count: g._count._all },
        linkType: null,
        linkId: null,
        dedupeKey: `${g.assigneeId}-${dedupDate}`,
      });
      if (ok) count++;
    }
  }
  return count;
}

/**
 * 主入口：lazy 触发，跑完所有 4 条规则。
 * 同进程内 60 秒节流，避免高频访问时反复扫库。
 */
let lastScanAt = 0;
const THROTTLE_MS = 60 * 1000;

export async function scanAnomalies(force = false): Promise<{
  scanned: boolean;
  counts: { overdue: number; unconfirmed: number; overload: number; insertions: number } | null;
}> {
  if (!force && Date.now() - lastScanAt < THROTTLE_MS) {
    return { scanned: false, counts: null };
  }
  lastScanAt = Date.now();

  const [overdue, unconfirmed, overload, insertions] = await Promise.all([
    scanOverdueTasks(),
    scanUnconfirmedThreeDays(),
    scanOverloadedUsers(),
    scanRepeatedInsertions(),
  ]);

  return {
    scanned: true,
    counts: { overdue, unconfirmed, overload, insertions },
  };
}
