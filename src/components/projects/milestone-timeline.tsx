"use client";

import { format, differenceInDays, startOfDay, addDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Flag } from "lucide-react";

interface MilestoneItem {
  id: string;
  name: string;
  phase: string;
  dueDate: string;
  isCompleted: boolean;
  completedAt: string | null;
  assignee: { id: string; name: string } | null;
}

interface Props {
  milestones: MilestoneItem[];
  projectStartDate: string | null;
  projectEndDate: string | null;
}

export function MilestoneTimeline({
  milestones,
  projectStartDate,
  projectEndDate,
}: Props) {
  const now = startOfDay(new Date());

  // 空状态：项目无节点时仍展示一条只含项目区间和今天的轴
  if (milestones.length === 0) {
    if (!projectStartDate && !projectEndDate) {
      return null;
    }
    return (
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Flag className="w-4 h-4 text-primary" />
            项目时间线
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            还没有添加设计节点。
            {projectStartDate && projectEndDate ? (
              <>
                项目计划区间：
                <span className="font-medium text-foreground">
                  {format(new Date(projectStartDate), "yyyy/MM/dd")} ~{" "}
                  {format(new Date(projectEndDate), "yyyy/MM/dd")}
                </span>
                。点击上面"添加节点"开始排时间线。
              </>
            ) : (
              <>请先在"基本信息"里填项目起止日期，再添加节点。</>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 时间轴范围：项目起止日期 ∪ 所有节点日期，再左右各加 7 天缓冲
  const milestoneDates = milestones.map((m) => new Date(m.dueDate).getTime());
  const candidateMin = [
    ...(projectStartDate ? [new Date(projectStartDate).getTime()] : []),
    ...milestoneDates,
    now.getTime(),
  ];
  const candidateMax = [
    ...(projectEndDate ? [new Date(projectEndDate).getTime()] : []),
    ...milestoneDates,
    now.getTime(),
  ];
  const rangeStart = addDays(new Date(Math.min(...candidateMin)), -7);
  const rangeEnd = addDays(new Date(Math.max(...candidateMax)), 7);
  const totalDays = Math.max(1, differenceInDays(rangeEnd, rangeStart));

  function dayToPercent(date: Date): number {
    const d = differenceInDays(startOfDay(date), rangeStart);
    return Math.max(0, Math.min(100, (d / totalDays) * 100));
  }

  // 按截止日期排序
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  // 计算下一个待办节点（最近未完成）
  const upcoming = sorted.find((m) => !m.isCompleted);

  // 月份刻度
  const months: { label: string; left: number }[] = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  if (cursor < rangeStart) cursor.setMonth(cursor.getMonth() + 1);
  while (cursor <= rangeEnd) {
    months.push({
      label: format(cursor, "yyyy/M"),
      left: dayToPercent(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // 周刻度（每周一）和日刻度（短任务跨度时）
  // 范围 ≤ 35 天 → 每天一个刻度；35~120 天 → 每周一刻度；>120 天 → 仅月初
  const tickMode: "day" | "week" | "month" =
    totalDays <= 35 ? "day" : totalDays <= 120 ? "week" : "month";
  const ticks: { left: number; major: boolean; label: string | null }[] = [];
  if (tickMode === "day") {
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(rangeStart, i);
      const isMonthStart = d.getDate() === 1;
      const isWeekStart = d.getDay() === 1; // 周一
      ticks.push({
        left: dayToPercent(d),
        major: isMonthStart || isWeekStart,
        label: isMonthStart || isWeekStart ? format(d, "M/d") : null,
      });
    }
  } else if (tickMode === "week") {
    const wc = new Date(rangeStart);
    // 对齐到周一
    const dow = wc.getDay() || 7;
    wc.setDate(wc.getDate() + (8 - dow) % 7);
    while (wc <= rangeEnd) {
      const isMonthStart = wc.getDate() <= 7;
      ticks.push({
        left: dayToPercent(wc),
        major: isMonthStart,
        label: format(wc, "M/d"),
      });
      wc.setDate(wc.getDate() + 7);
    }
  } else {
    // month-only：用月初刻度兼任
    months.forEach((m) =>
      ticks.push({ left: m.left, major: true, label: null })
    );
  }

  const todayPercent = dayToPercent(now);

  // 项目区间条
  const projStartPct = projectStartDate
    ? dayToPercent(new Date(projectStartDate))
    : null;
  const projEndPct = projectEndDate
    ? dayToPercent(new Date(projectEndDate))
    : null;

  function statusColor(m: MilestoneItem): { dot: string; ring: string; text: string } {
    if (m.isCompleted) {
      return {
        dot: "bg-green-500",
        ring: "ring-green-200",
        text: "text-green-700",
      };
    }
    const due = new Date(m.dueDate);
    if (due < now) {
      return { dot: "bg-red-500", ring: "ring-red-200", text: "text-red-700" };
    }
    if (differenceInDays(due, now) <= 7) {
      return {
        dot: "bg-amber-500",
        ring: "ring-amber-200",
        text: "text-amber-700",
      };
    }
    return { dot: "bg-primary", ring: "ring-primary/30", text: "text-primary" };
  }

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flag className="w-4 h-4 text-primary" />
            项目时间线
          </div>
          {upcoming && (
            <div className="text-xs text-muted-foreground">
              下一个：
              <span className={statusColor(upcoming).text + " font-medium"}>
                {upcoming.name}
              </span>{" "}
              · {format(new Date(upcoming.dueDate), "MM-dd")}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px] relative pt-6 pb-12">
            {/* 月份刻度 */}
            <div className="relative h-5 mb-1">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute -top-1 text-[10px] text-muted-foreground font-medium"
                  style={{ left: `${m.left}%` }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* 周/日刻度尺 */}
            <div className="relative h-5 mb-1">
              {ticks.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0"
                  style={{ left: `${t.left}%` }}
                >
                  <div
                    className={`w-px ${
                      t.major ? "h-2.5 bg-muted-foreground/50" : "h-1.5 bg-muted-foreground/25"
                    }`}
                  />
                  {t.label && t.major && (
                    <span className="absolute top-2.5 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap">
                      {t.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* 主轴线 + 项目区间条 */}
            <div className="relative h-3 bg-muted/40 rounded-full">
              {/* 轴上细刻度（仅 major） */}
              {ticks.map((t, i) =>
                t.major ? (
                  <div
                    key={`tick-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-muted-foreground/15"
                    style={{ left: `${t.left}%` }}
                  />
                ) : null
              )}
              {projStartPct !== null && projEndPct !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-primary/15 rounded-full ring-1 ring-primary/30"
                  style={{
                    left: `${projStartPct}%`,
                    width: `${Math.max(0.5, projEndPct - projStartPct)}%`,
                  }}
                  title="项目计划区间"
                />
              )}

              {/* 今天标线 */}
              <div
                className="absolute -top-1 -bottom-6 w-0.5 bg-red-500 z-20"
                style={{ left: `${todayPercent}%` }}
              >
                <span className="absolute -top-5 -translate-x-1/2 text-[9px] text-red-600 font-bold bg-red-50 px-1 py-0.5 rounded whitespace-nowrap">
                  今天
                </span>
              </div>

              {/* 节点圆点 */}
              {sorted.map((m, i) => {
                const c = statusColor(m);
                const left = dayToPercent(new Date(m.dueDate));
                const labelBelow = i % 2 === 0;
                return (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 group"
                    style={{ left: `${left}%` }}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${c.dot} ring-2 ${c.ring} cursor-pointer hover:scale-125 transition-transform`}
                    />
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 ${
                        labelBelow ? "top-4" : "bottom-4"
                      } whitespace-nowrap text-[10px] ${c.text} font-medium pointer-events-none`}
                    >
                      <div className="bg-card px-1.5 py-0.5 rounded shadow-soft border border-border/50 max-w-[120px] truncate">
                        {m.name}
                      </div>
                      <div className="text-muted-foreground text-[9px] text-center mt-0.5">
                        {format(new Date(m.dueDate), "MM-dd")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 项目起止标签 */}
            <div className="relative h-4 mt-2">
              {projectStartDate && projStartPct !== null && (
                <div
                  className="absolute text-[9px] text-muted-foreground"
                  style={{ left: `${projStartPct}%`, transform: "translateX(-50%)" }}
                >
                  <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                  {format(new Date(projectStartDate), "yyyy/MM/dd")}
                </div>
              )}
              {projectEndDate && projEndPct !== null && (
                <div
                  className="absolute text-[9px] text-muted-foreground"
                  style={{ left: `${projEndPct}%`, transform: "translateX(-50%)" }}
                >
                  <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                  {format(new Date(projectEndDate), "yyyy/MM/dd")}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground mt-3 pt-3 border-t">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> 已完成
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> 已逾期
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 7 天内到期
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" /> 待办
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <span className="w-3 h-1 bg-primary/15 ring-1 ring-primary/30 rounded" /> 项目计划区间
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
