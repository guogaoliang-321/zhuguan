"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays, max, min, startOfDay, addDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  FolderKanban,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { PHASE_LABELS } from "@/lib/constants";
import type {
  PersonBoardItem,
  PersonWorkLog,
  ProjectTimeline,
  TimelineMilestone,
  PeopleBoardResponse,
} from "@/app/api/worklogs/people-board/route";

// ====== 项目色板 ======
const PROJECT_COLORS = [
  { bg: "bg-[#6c5ce7]", bgLight: "bg-[#6c5ce7]/15", text: "text-[#6c5ce7]", hex: "#6c5ce7" },
  { bg: "bg-[#00b894]", bgLight: "bg-[#00b894]/15", text: "text-[#00b894]", hex: "#00b894" },
  { bg: "bg-[#e84393]", bgLight: "bg-[#e84393]/15", text: "text-[#e84393]", hex: "#e84393" },
  { bg: "bg-[#fdcb6e]", bgLight: "bg-[#fdcb6e]/20", text: "text-[#e17055]", hex: "#fdcb6e" },
  { bg: "bg-[#0984e3]", bgLight: "bg-[#0984e3]/15", text: "text-[#0984e3]", hex: "#0984e3" },
  { bg: "bg-[#e17055]", bgLight: "bg-[#e17055]/15", text: "text-[#e17055]", hex: "#e17055" },
  { bg: "bg-[#00cec9]", bgLight: "bg-[#00cec9]/15", text: "text-[#00cec9]", hex: "#00cec9" },
  { bg: "bg-[#a29bfe]", bgLight: "bg-[#a29bfe]/15", text: "text-[#a29bfe]", hex: "#a29bfe" },
];

const RANGE_PRESETS = [
  { value: "this-week", label: "本周" },
  { value: "this-month", label: "本月" },
  { value: "this-quarter", label: "本季" },
  { value: "last-30", label: "近 30 天" },
] as const;

export default function WorkloadPage() {
  const [people, setPeople] = useState<PersonBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [rangePreset, setRangePreset] = useState<string>("this-month");
  const [rangeMeta, setRangeMeta] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worklogs/people-board?range=${rangePreset}`)
      .then((r) => r.json())
      .then((data: PeopleBoardResponse) => {
        setPeople(data.items);
        setRangeMeta({ from: data.from, to: data.to });
        setExpandedIds(new Set(data.items.map((p) => p.userId)));
        setLoading(false);
      });
  }, [rangePreset]);

  // 全局项目色映射
  const projectColorMap = useMemo(() => {
    const map = new Map<string, typeof PROJECT_COLORS[0]>();
    const allProjectIds = new Set<string>();
    people.forEach((p) =>
      p.projectTimelines.forEach((pt) => allProjectIds.add(pt.projectId))
    );
    let i = 0;
    allProjectIds.forEach((id) => {
      map.set(id, PROJECT_COLORS[i % PROJECT_COLORS.length]);
      i++;
    });
    return map;
  }, [people]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = people.filter(
    (p) =>
      !search ||
      p.name.includes(search) ||
      p.position?.includes(search) ||
      p.projectTimelines.some((pt) => pt.projectName.includes(search))
  );

  const totalOverdue = people.reduce((s, p) => s + p.overdueCount, 0);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-9 w-64 rounded-xl mb-2" />
        <Skeleton className="h-5 w-80 rounded-lg mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl mb-4" />
        ))}
      </div>
    );
  }

  const totalRangeHours = people.reduce((s, p) => s + p.rangeHours, 0);
  const avgSaturation =
    people.length > 0
      ? Math.round(people.reduce((s, p) => s + p.rangeSaturation, 0) / people.length)
      : 0;

  const rangeLabelText = rangeMeta
    ? `${format(new Date(rangeMeta.from), "M/d")} – ${format(new Date(rangeMeta.to), "M/d")}`
    : "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">人员工作看板</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            跨项目追踪每个人的时间进度、工作内容和待办节点
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-card rounded-xl p-1 shadow-soft">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setRangePreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                rangePreset === p.value
                  ? "gradient-primary text-white shadow-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard emoji="👥" label="在岗人员" value={people.length} />
        <StatCard
          emoji="📊"
          label={`总工时 ${rangeLabelText ? `· ${rangeLabelText}` : ""}`}
          value={`${Math.round(totalRangeHours)}h`}
        />
        <StatCard
          emoji="🔥"
          label="平均饱和度"
          value={`${avgSaturation}%`}
          color={avgSaturation >= 110 ? "text-destructive" : avgSaturation >= 85 ? "text-success" : ""}
        />
        <StatCard
          emoji="🚨"
          label="逾期节点"
          value={totalOverdue}
          color={totalOverdue > 0 ? "text-destructive" : ""}
        />
      </div>

      {/* 团队横向对比 */}
      <TeamComparison people={people} />

      {/* 搜索 */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索姓名、职务、项目名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-card border-0 shadow-soft h-10"
        />
      </div>

      {/* 人员卡片 */}
      <div className="space-y-4">
        {filtered.map((person) => (
          <PersonCard
            key={person.userId}
            person={person}
            expanded={expandedIds.has(person.userId)}
            onToggle={() => toggleExpand(person.userId)}
            colorMap={projectColorMap}
          />
        ))}
      </div>
    </div>
  );
}

// ====== 团队横向对比 ======
function TeamComparison({ people }: { people: PersonBoardItem[] }) {
  const sorted = [...people].sort((a, b) => b.rangeHours - a.rangeHours);
  const maxHours = Math.max(1, ...sorted.map((p) => p.rangeHours));

  if (sorted.length === 0) return null;

  return (
    <Card className="shadow-soft rounded-2xl mb-6">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">团队工时对比</h3>
          <span className="text-[11px] text-muted-foreground">
            按时间范围排序
          </span>
        </div>
        <div className="space-y-2.5">
          {sorted.map((p) => {
            const pct = (p.rangeHours / maxHours) * 100;
            const saturationColor =
              p.rangeSaturation >= 110
                ? "bg-destructive"
                : p.rangeSaturation >= 85
                  ? "bg-success"
                  : p.rangeSaturation >= 50
                    ? "gradient-primary"
                    : "bg-warning";
            const satLabel =
              p.rangeSaturation >= 110
                ? { text: "超载", className: "text-destructive" }
                : p.rangeSaturation >= 85
                  ? { text: "饱满", className: "text-success" }
                  : p.rangeSaturation >= 50
                    ? { text: "正常", className: "text-primary" }
                    : { text: "偏低", className: "text-warning-foreground" };
            return (
              <div key={p.userId} className="flex items-center gap-3">
                <div className="w-16 sm:w-20 shrink-0 text-xs font-medium truncate">
                  {p.name}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">
                      {p.rangeHours}h
                    </span>
                    <span className={`font-medium ${satLabel.className}`}>
                      {p.rangeSaturation}% · {satLabel.text}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${saturationColor} rounded-full transition-all`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ====== 统计卡片 ======
function StatCard({
  emoji, label, value, color,
}: {
  emoji: string; label: string; value: number | string; color?: string;
}) {
  return (
    <Card className="shadow-soft rounded-2xl hover-lift">
      <CardContent className="pt-5 pb-4">
        <div className="text-xl mb-2">{emoji}</div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className={`text-2xl font-bold tracking-tight ${color ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ====== 人员卡片 ======
function PersonCard({
  person,
  expanded,
  onToggle,
  colorMap,
}: {
  person: PersonBoardItem;
  expanded: boolean;
  onToggle: () => void;
  colorMap: Map<string, typeof PROJECT_COLORS[0]>;
}) {
  const router = useRouter();
  const hasOverdue = person.overdueCount > 0;

  return (
    <Card className={`shadow-soft rounded-2xl ${hasOverdue ? "ring-1 ring-destructive/20" : ""}`}>
      {/* 头部 */}
      <div
        className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-2xl"
        onClick={onToggle}
      >
        <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-base shrink-0 shadow-primary/30 shadow-md">
          {person.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{person.name}</span>
            <span className="text-xs text-muted-foreground">{person.position}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FolderKanban className="w-3 h-3" />
              {person.projectTimelines.length} 个项目
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              本周 {person.thisWeekHours}h · 上周 {person.lastWeekHours}h
            </span>
            {hasOverdue && (
              <Badge variant="secondary" className="rounded-full text-[10px] bg-destructive/10 text-destructive">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                {person.overdueCount} 个逾期
              </Badge>
            )}
            {person.thisWeekLogs.length === 0 && (
              <Badge
                variant="secondary"
                className="rounded-full text-[10px] bg-warning/20 text-warning-foreground"
              >
                本周未填
              </Badge>
            )}
          </div>
        </div>

        {/* 项目色块 - 带项目名 */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0 flex-wrap justify-end max-w-[400px]">
          {person.projectTimelines.slice(0, 4).map((pt) => {
            const c = colorMap.get(pt.projectId) ?? PROJECT_COLORS[0];
            return (
              <Badge
                key={pt.projectId}
                variant="secondary"
                className={`rounded-full text-[10px] px-2 py-0.5 ${c.bgLight} ${c.text} font-medium`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.bg} mr-1 inline-block`} />
                {pt.projectName.length > 10 ? pt.projectName.slice(0, 10) + "…" : pt.projectName}
              </Badge>
            );
          })}
          {person.projectTimelines.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{person.projectTimelines.length - 4}</span>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* 展开内容 */}
      {expanded && (
        <CardContent className="pt-0 pb-6">
          <div className="border-t border-border pt-4">
            {/* 甘特时间线 */}
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              项目时间线
            </h4>
            <GanttTimeline
              timelines={person.projectTimelines}
              colorMap={colorMap}
              onProjectClick={(id) => router.push(`/projects/${id}`)}
            />

            {/* 工作明细 - 两栏 */}
            <div className="grid gap-6 lg:grid-cols-2 mt-6">
              {/* 本周/上周工作 */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  本周工作 <span className="text-primary font-bold">{person.thisWeekHours}h</span>
                </h4>
                <WorkLogList logs={person.thisWeekLogs} colorMap={colorMap} emptyText="本周暂无记录" />

                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-5">
                  上周工作 <span className="font-bold">{person.lastWeekHours}h</span>
                </h4>
                <WorkLogList logs={person.lastWeekLogs} colorMap={colorMap} emptyText="上周暂无记录" />
              </div>

              {/* 在手项目详情 */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  在手项目与节点
                </h4>
                <div className="space-y-3">
                  {person.projectTimelines.map((pt) => {
                    const c = colorMap.get(pt.projectId) ?? PROJECT_COLORS[0];
                    const now = new Date();
                    const overdue = pt.milestones.filter(
                      (ms) => !ms.isCompleted && new Date(ms.dueDate) < now
                    );
                    const upcoming = pt.milestones.filter(
                      (ms) => !ms.isCompleted && new Date(ms.dueDate) >= now
                    );
                    const completed = pt.milestones.filter((ms) => ms.isCompleted);

                    return (
                      <div
                        key={pt.projectId}
                        className={`rounded-xl ${c.bgLight} p-3 cursor-pointer hover:shadow-soft transition-all group`}
                        onClick={() => router.push(`/projects/${pt.projectId}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${c.bg}`} />
                            <span className="text-sm font-semibold">{pt.projectName}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="rounded-full text-[10px] px-1.5">
                              {PHASE_LABELS[pt.phase]}
                            </Badge>
                            {pt.isLead && (
                              <Badge className="rounded-full text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                                负责人
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          {pt.role}
                          {pt.startDate && pt.endDate && (
                            <> · {format(new Date(pt.startDate), "yy/MM/dd")} - {format(new Date(pt.endDate), "yy/MM/dd")}</>
                          )}
                        </p>

                        {/* 节点列表 */}
                        {(overdue.length > 0 || upcoming.length > 0 || completed.length > 0) && (
                          <div className="space-y-1 mt-1">
                            {overdue.map((ms) => (
                              <MilestoneRow key={ms.id} ms={ms} type="overdue" />
                            ))}
                            {upcoming.slice(0, 3).map((ms) => (
                              <MilestoneRow key={ms.id} ms={ms} type="upcoming" />
                            ))}
                            {completed.slice(-2).map((ms) => (
                              <MilestoneRow key={ms.id} ms={ms} type="completed" />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ====== 甘特时间线 ======
function GanttTimeline({
  timelines,
  colorMap,
  onProjectClick,
}: {
  timelines: ProjectTimeline[];
  colorMap: Map<string, typeof PROJECT_COLORS[0]>;
  onProjectClick: (id: string) => void;
}) {
  const now = startOfDay(new Date());

  // 3个月范围：向前1周 ~ 向后12周
  const rangeStart = addDays(now, -7);
  const rangeEnd = addDays(now, 84);
  const totalDays = differenceInDays(rangeEnd, rangeStart);

  function dayToPercent(date: Date) {
    const d = differenceInDays(startOfDay(date), rangeStart);
    return Math.max(0, Math.min(100, (d / totalDays) * 100));
  }

  const todayPercent = dayToPercent(now);

  // 周刻度 - 每7天一个
  const weeks: { label: string; left: number; isMonthStart: boolean }[] = [];
  const weekCursor = new Date(rangeStart);
  // 对齐到周一
  const dayOfWeek = weekCursor.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  weekCursor.setDate(weekCursor.getDate() + daysToMonday);
  while (weekCursor <= rangeEnd) {
    const isMonthStart = weekCursor.getDate() <= 7;
    weeks.push({
      label: format(weekCursor, "M/d"),
      left: dayToPercent(weekCursor),
      isMonthStart,
    });
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  // 月份标签（在顶部显示月份）
  const months: { label: string; left: number; width: number }[] = [];
  const monthCursor = new Date(rangeStart);
  monthCursor.setDate(1);
  if (monthCursor < rangeStart) monthCursor.setMonth(monthCursor.getMonth() + 1);
  while (monthCursor <= rangeEnd) {
    const nextMonth = new Date(monthCursor);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    months.push({
      label: format(monthCursor, "yyyy年M月"),
      left: dayToPercent(monthCursor),
      width: dayToPercent(nextMonth > rangeEnd ? rangeEnd : nextMonth) - dayToPercent(monthCursor),
    });
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  const LABEL_WIDTH = 160; // px, 项目名区域宽度

  if (timelines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">暂无在手项目</p>
    );
  }

  return (
    <div className="rounded-xl bg-muted/30 p-4 overflow-x-auto">
      <div style={{ minWidth: "700px" }}>
        {/* 月份标签行 */}
        <div className="relative h-5 mb-0" style={{ marginLeft: `${LABEL_WIDTH}px` }}>
          {months.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 text-[10px] font-semibold text-foreground/70"
              style={{ left: `${m.left}%` }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* 周刻度行 */}
        <div className="relative h-5 border-b border-border/50" style={{ marginLeft: `${LABEL_WIDTH}px` }}>
          {weeks.map((w, i) => (
            <div key={i} className="absolute top-0 bottom-0" style={{ left: `${w.left}%` }}>
              <div className={`h-full w-px ${w.isMonthStart ? "bg-border" : "bg-border/30"}`} />
              <span className="absolute top-0 left-0.5 text-[9px] text-muted-foreground">
                {w.label}
              </span>
            </div>
          ))}
          {/* 今天标线 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
            style={{ left: `${todayPercent}%` }}
          >
            <span className="absolute -top-3.5 -translate-x-1/2 text-[9px] text-destructive font-bold bg-destructive/10 px-1 py-0.5 rounded">
              今天
            </span>
          </div>
        </div>

        {/* 项目行 */}
        <div className="mt-1">
          {timelines.map((pt) => {
            const c = colorMap.get(pt.projectId) ?? PROJECT_COLORS[0];
            const pStart = pt.startDate ? new Date(pt.startDate) : addDays(now, -30);
            const pEnd = pt.endDate ? new Date(pt.endDate) : addDays(now, 60);
            const barLeft = dayToPercent(pStart);
            const barRight = dayToPercent(pEnd);
            const barWidth = Math.max(1, barRight - barLeft);

            return (
              <div key={pt.projectId} className="flex h-16 border-b border-border/20">
                {/* 项目名 */}
                <div
                  className="shrink-0 flex items-start gap-1.5 cursor-pointer pr-2 overflow-hidden pt-2"
                  style={{ width: `${LABEL_WIDTH}px` }}
                  onClick={() => onProjectClick(pt.projectId)}
                >
                  <div className={`w-2.5 h-2.5 rounded-sm ${c.bg} shrink-0 mt-0.5`} />
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium truncate hover:underline block">
                      {pt.projectName}
                    </span>
                    <span className="text-[9px] text-muted-foreground block">
                      {pt.role}
                    </span>
                  </div>
                </div>

                {/* 甘特区域 */}
                <div className="flex-1 relative">
                  {/* 周刻度竖线(背景) */}
                  {weeks.map((w, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 w-px ${w.isMonthStart ? "bg-border/40" : "bg-border/15"}`}
                      style={{ left: `${w.left}%` }}
                    />
                  ))}

                  {/* 今天竖线 */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-destructive/40 z-5"
                    style={{ left: `${todayPercent}%` }}
                  />

                  {/* 进度条 */}
                  <div
                    className={`absolute bottom-2 h-4 rounded-md ${c.bg} opacity-85 hover:opacity-100 transition-opacity cursor-pointer shadow-sm`}
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidth}%`,
                      minWidth: "6px",
                    }}
                    title={`${pt.projectName} · ${pt.role}\n${pt.startDate ? format(pStart, "yyyy-MM-dd") : "?"} → ${pt.endDate ? format(pEnd, "yyyy-MM-dd") : "?"}`}
                    onClick={() => onProjectClick(pt.projectId)}
                  >
                    {barWidth > 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-medium truncate px-1">
                        {pt.startDate && format(pStart, "M/d")} → {pt.endDate && format(pEnd, "M/d")}
                      </span>
                    )}
                  </div>

                  {/* 里程碑标记 - 始终显示名称 */}
                  {pt.milestones.map((ms) => {
                    const msDate = new Date(ms.dueDate);
                    const msLeft = dayToPercent(msDate);
                    const isOverdue = !ms.isCompleted && msDate < now;
                    const isDueSoon =
                      !ms.isCompleted && !isOverdue && differenceInDays(msDate, now) <= 3;

                    const dotColor = ms.isCompleted
                      ? "bg-success"
                      : isOverdue
                        ? "bg-destructive"
                        : isDueSoon
                          ? "bg-warning"
                          : c.bg;

                    const labelColor = ms.isCompleted
                      ? "text-success"
                      : isOverdue
                        ? "text-destructive font-semibold"
                        : isDueSoon
                          ? "text-warning-foreground font-semibold"
                          : "text-foreground/70";

                    return (
                      <div
                        key={ms.id}
                        className="absolute z-20 flex flex-col items-center"
                        style={{ left: `${msLeft}%`, transform: "translateX(-50%)", bottom: 0, top: 0 }}
                      >
                        {/* 标签 - 圆点上方 */}
                        <div
                          className={`whitespace-nowrap text-[8px] leading-tight ${labelColor} max-w-[60px] truncate text-center`}
                          title={`${ms.name} ${format(msDate, "M/d")}`}
                        >
                          <span className="text-[7px] text-muted-foreground">
                            {ms.isCompleted ? "✓" : format(msDate, "M/d")}
                          </span>
                          <br />
                          {ms.name.length > 5 ? ms.name.slice(0, 5) + "…" : ms.name}
                        </div>
                        {/* 连接线 */}
                        <div className={`w-px flex-1 ${dotColor} opacity-50`} />
                        {/* 圆点 */}
                        <div
                          className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${dotColor} ${isOverdue && !ms.isCompleted ? "animate-pulse" : ""} flex items-center justify-center shrink-0 mb-1`}
                        >
                          {ms.isCompleted && (
                            <CheckCircle2 className="w-2 h-2 text-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-5 mt-3 pt-2 border-t border-border/30" style={{ marginLeft: `${LABEL_WIDTH}px` }}>
          <span className="text-[10px] text-muted-foreground font-medium">节点状态：</span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-success border-2 border-white shadow-sm" /> 已完成
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-warning border-2 border-white shadow-sm" /> 3天内到期
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-destructive border-2 border-white shadow-sm" /> 已逾期
          </div>
          <span className="text-[10px] text-border">|</span>
          <span className="text-[10px] text-muted-foreground font-medium">彩色横条 = 项目时间跨度</span>
          <span className="text-[10px] text-muted-foreground">|</span>
          <span className="text-[10px] text-destructive font-medium">红线 = 今天</span>
        </div>
      </div>
    </div>
  );
}

// ====== 里程碑行 ======
function MilestoneRow({
  ms,
  type,
}: {
  ms: TimelineMilestone;
  type: "overdue" | "upcoming" | "completed";
}) {
  const now = new Date();
  const due = new Date(ms.dueDate);
  const diff = differenceInDays(due, now);

  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      {type === "completed" ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
      ) : type === "overdue" ? (
        <Circle className="w-3.5 h-3.5 text-destructive fill-destructive/20 shrink-0" />
      ) : (
        <Circle className={`w-3.5 h-3.5 shrink-0 ${diff <= 3 ? "text-warning fill-warning/20" : "text-muted-foreground"}`} />
      )}
      <span className={`flex-1 ${type === "completed" ? "line-through text-muted-foreground" : ""}`}>
        {ms.name}
      </span>
      <span
        className={`text-[10px] shrink-0 font-medium ${
          type === "overdue"
            ? "text-destructive"
            : type === "completed"
              ? "text-success"
              : diff <= 3
                ? "text-warning-foreground"
                : "text-muted-foreground"
        }`}
      >
        {type === "overdue"
          ? `逾期${Math.abs(diff)}天`
          : type === "completed"
            ? "✓"
            : format(due, "MM/dd")}
      </span>
    </div>
  );
}

// ====== 工作记录列表 ======
function WorkLogList({
  logs,
  colorMap,
  emptyText,
}: {
  logs: PersonWorkLog[];
  colorMap: Map<string, typeof PROJECT_COLORS[0]>;
  emptyText: string;
}) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2 text-center">{emptyText}</p>
    );
  }

  // 按项目分组
  const grouped = new Map<string, PersonWorkLog[]>();
  for (const log of logs) {
    if (!grouped.has(log.projectId)) grouped.set(log.projectId, []);
    grouped.get(log.projectId)!.push(log);
  }

  return (
    <div className="space-y-2.5">
      {Array.from(grouped.entries()).map(([projectId, projectLogs]) => {
        const c = colorMap.get(projectId) ?? PROJECT_COLORS[0];
        const totalH = projectLogs.reduce((s, l) => s + l.hours, 0);
        return (
          <div key={projectId} className={`rounded-xl ${c.bgLight} p-2.5 border-l-3`} style={{ borderLeftColor: c.hex }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${c.bg}`} />
                <span className="text-xs font-semibold">{projectLogs[0].projectName}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{totalH}h</span>
            </div>
            {projectLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs py-0.5 pl-3.5">
                <span className="text-muted-foreground w-10 shrink-0">{format(new Date(log.date), "MM/dd")}</span>
                <span className="flex-1">{log.content}</span>
                {log.category && (
                  <Badge variant="secondary" className="rounded-full text-[9px] px-1.5 py-0 shrink-0">
                    {log.category}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
