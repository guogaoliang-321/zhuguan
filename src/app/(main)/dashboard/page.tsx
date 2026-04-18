"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, differenceInDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LayoutGrid,
  List,
  MessageSquare,
  ClipboardList,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_LABELS, PHASE_OPTIONS } from "@/lib/constants";
import type { DashboardProject, DashboardStats, TrafficLight } from "@/app/api/dashboard/route";

interface ActivityItem {
  id: string;
  type: "note" | "worklog" | "milestone";
  time: string;
  userName: string;
  projectId: string;
  projectName: string;
  content: string;
  extra?: string;
}

type ViewMode = "card" | "table";
type StatFilter = null | "active" | "green" | "yellow" | "red";

const LIGHT_CONFIG: Record<TrafficLight, { label: string; color: string; dot: string }> = {
  green: { label: "正常", color: "bg-success/10 text-success", dot: "bg-success" },
  yellow: { label: "即将到期", color: "bg-warning/20 text-warning-foreground", dot: "bg-warning" },
  red: { label: "已逾期", color: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  gray: { label: "无节点", color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const GRADIENT_AVATARS = [
  "gradient-primary",
  "gradient-pink",
  "gradient-green",
  "bg-gradient-to-br from-chart-5 to-warning-foreground",
];

export default function DashboardPage() {
  const router = useRouter();
  const projectListRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("card");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [lightFilter, setLightFilter] = useState("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [statFilter, setStatFilter] = useState<StatFilter>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects);
        setStats(data.stats);
        setActivities(data.recentActivities ?? []);
        setLoading(false);
      });
  }, []);

  const leads = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.lead.id, p.lead.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (phaseFilter !== "all" && p.phase !== phaseFilter) return false;
      if (lightFilter !== "all" && p.light !== lightFilter) return false;
      if (leadFilter !== "all" && p.lead.id !== leadFilter) return false;
      if (statFilter === "active" && p.status !== "ACTIVE") return false;
      if (
        (statFilter === "green" ||
          statFilter === "yellow" ||
          statFilter === "red") &&
        p.light !== statFilter
      ) {
        return false;
      }
      return true;
    });
  }, [projects, phaseFilter, lightFilter, leadFilter, statFilter]);

  function dueLabel(p: DashboardProject) {
    if (!p.nearestMilestone) return "-";
    const due = new Date(p.nearestMilestone.dueDate);
    const diff = differenceInDays(due, new Date());
    if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
    if (diff === 0) return "今天到期";
    return format(due, "MM/dd");
  }

  function toggleStat(next: Exclude<StatFilter, null>) {
    setStatFilter((prev) => (prev === next ? null : next));
    setTimeout(() => {
      projectListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-5 w-64 mt-2 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">进度看板</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">实时掌握全所项目进展</p>
      </div>

      {/* Stats - 手机端紧凑四列（可点击筛选） */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
        <StatCard
          emoji="📌"
          label="进行中"
          value={stats!.active}
          change={`共${stats!.total}个`}
          active={statFilter === "active"}
          onClick={() => toggleStat("active")}
        />
        <StatCard
          emoji="✅"
          label="正常"
          value={stats!.green}
          color="text-success"
          change={stats!.active > 0 ? `${Math.round((stats!.green / stats!.active) * 100)}%` : "0%"}
          active={statFilter === "green"}
          ring="ring-success"
          onClick={() => toggleStat("green")}
        />
        <StatCard
          emoji="⚠️"
          label="即将到期"
          value={stats!.yellow}
          color="text-warning-foreground"
          change="3天内"
          active={statFilter === "yellow"}
          ring="ring-warning"
          onClick={() => toggleStat("yellow")}
        />
        <StatCard
          emoji="🚨"
          label="已逾期"
          value={stats!.red}
          color="text-destructive"
          change="需处理"
          active={statFilter === "red"}
          ring="ring-destructive"
          onClick={() => toggleStat("red")}
        />
      </div>

      {/* 最新项目动态 - 轮播 */}
      <ActivityCarousel activities={activities} />

      {/* Toolbar */}
      <div ref={projectListRef} className="flex flex-wrap items-center justify-between gap-3 mb-6 scroll-mt-4">
        <div className="flex flex-wrap gap-2">
          <FilterButton active={phaseFilter === "all"} onClick={() => setPhaseFilter("all")}>全部</FilterButton>
          {PHASE_OPTIONS.map((o) => (
            <FilterButton key={o.value} active={phaseFilter === o.value} onClick={() => setPhaseFilter(o.value)}>
              {o.label}
            </FilterButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={lightFilter} onValueChange={(v) => v && setLightFilter(v)}>
            <SelectTrigger className="w-[120px] rounded-xl bg-card border-0 shadow-soft h-9 text-sm">
              <SelectValue placeholder="状态灯" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="green">正常</SelectItem>
              <SelectItem value="yellow">即将到期</SelectItem>
              <SelectItem value="red">已逾期</SelectItem>
            </SelectContent>
          </Select>
          <Select value={leadFilter} onValueChange={(v) => v && setLeadFilter(v)}>
            <SelectTrigger className="w-[120px] rounded-xl bg-card border-0 shadow-soft h-9 text-sm">
              <SelectValue placeholder="负责人" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">全部人员</SelectItem>
              {leads.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex bg-card rounded-xl p-1 shadow-soft">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${view === "card" ? "gradient-primary text-white shadow-primary" : "text-muted-foreground"}`}
              onClick={() => setView("card")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${view === "table" ? "gradient-primary text-white shadow-primary" : "text-muted-foreground"}`}
              onClick={() => setView("table")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 当前筛选提示 */}
      {statFilter && (
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <span>已筛选：</span>
          <Badge variant="secondary" className="rounded-full text-[11px]">
            {statFilter === "active"
              ? "进行中"
              : statFilter === "green"
                ? "正常"
                : statFilter === "yellow"
                  ? "即将到期"
                  : "已逾期"}
          </Badge>
          <button
            onClick={() => setStatFilter(null)}
            className="text-primary hover:underline"
          >
            清除
          </button>
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            没有符合条件的项目
          </CardContent>
        </Card>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <ProjectCard key={p.id} project={p} dueLabel={dueLabel(p)} avatarClass={GRADIENT_AVATARS[i % GRADIENT_AVATARS.length]} onClick={() => router.push(`/projects/${p.id}`)} />
          ))}
        </div>
      ) : (
        <Card className="shadow-soft rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">项目名称</TableHead>
                <TableHead className="font-semibold">甲方</TableHead>
                <TableHead className="font-semibold">阶段</TableHead>
                <TableHead className="font-semibold">状态灯</TableHead>
                <TableHead className="font-semibold">负责人</TableHead>
                <TableHead className="font-semibold">进度</TableHead>
                <TableHead className="font-semibold">最近节点</TableHead>
                <TableHead className="font-semibold">截止</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const lc = LIGHT_CONFIG[p.light];
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.clientName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full text-xs bg-accent text-accent-foreground">
                        {PHASE_LABELS[p.phase]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`rounded-full text-xs ${lc.color}`}>
                        <span className={`w-2 h-2 rounded-full ${lc.dot} mr-1.5 inline-block`} />
                        {lc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.lead.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.light === "red" ? "bg-destructive" : p.light === "yellow" ? "bg-warning" : "gradient-green"}`}
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{p.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.nearestMilestone?.name ?? "-"}</TableCell>
                    <TableCell className={`text-sm ${p.light === "red" ? "text-destructive font-medium" : p.light === "yellow" ? "text-warning-foreground" : ""}`}>
                      {dueLabel(p)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ====== Sub Components ======

function StatCard({
  emoji,
  label,
  value,
  color,
  change,
  active,
  ring,
  onClick,
}: {
  emoji: string;
  label: string;
  value: number;
  color?: string;
  change: string;
  active?: boolean;
  ring?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left w-full rounded-xl sm:rounded-2xl transition-all focus:outline-none",
        active && `ring-2 ring-offset-2 ring-offset-background ${ring ?? "ring-primary"}`
      )}
    >
      <Card className="hover-lift shadow-soft rounded-xl sm:rounded-2xl h-full">
        <CardContent className="pt-3 pb-3 px-2 sm:pt-6 sm:pb-4 sm:px-6 h-full flex flex-col">
          <div className="text-lg sm:text-2xl mb-1 sm:mb-3 leading-none">{emoji}</div>
          <p className="text-[11px] sm:text-[13px] text-muted-foreground font-medium mb-1 sm:mb-1.5 leading-tight whitespace-nowrap">
            {label}
          </p>
          <p className={`text-2xl sm:text-4xl font-bold tracking-tight ${color ?? ""}`}>{value}</p>
          <Badge
            variant="secondary"
            className="mt-1.5 sm:mt-2 rounded-full text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0 max-w-full whitespace-nowrap"
          >
            {change}
          </Badge>
        </CardContent>
      </Card>
    </button>
  );
}

function FilterButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all shadow-soft ${
        active
          ? "gradient-primary text-white shadow-primary"
          : "bg-card text-muted-foreground hover:text-foreground hover:-translate-y-0.5"
      }`}
    >
      {children}
    </button>
  );
}

function ActivityCarousel({ activities }: { activities: ActivityItem[] }) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[i] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  };

  const prev = () => {
    const next = Math.max(0, index - 1);
    setIndex(next);
    scrollTo(next);
  };

  const next = () => {
    const nextIdx = Math.min(activities.length - 1, index + 1);
    setIndex(nextIdx);
    scrollTo(nextIdx);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const scrollLeft = track.scrollLeft;
    let closest = 0;
    let min = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const delta = Math.abs(el.offsetLeft - track.offsetLeft - scrollLeft);
      if (delta < min) {
        min = delta;
        closest = i;
      }
    });
    setIndex(closest);
  };

  return (
    <Card className="shadow-soft rounded-2xl mb-6 sm:mb-8">
      <CardContent className="pt-4 pb-4 sm:pt-5 sm:pb-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-sm font-semibold shrink-0">最新项目动态</h3>
          <Link
            href="/activities"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
          >
            查看全部动态
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">暂无动态</p>
        ) : (
          <>
            <div
              ref={trackRef}
              onScroll={handleScroll}
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
            >
              {activities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => router.push(`/projects/${a.projectId}`)}
                  className="snap-start shrink-0 basis-full sm:basis-[calc(50%-6px)] lg:basis-[calc(33.333%-8px)] text-left"
                >
                  <div className="h-full rounded-xl border border-border/60 bg-card p-3.5 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          a.type === "note"
                            ? "bg-primary/10 text-primary"
                            : a.type === "milestone"
                              ? "bg-success/10 text-success"
                              : "bg-chart-5/10 text-chart-5"
                        }`}
                      >
                        {a.type === "note" ? (
                          <MessageSquare className="w-4 h-4" />
                        ) : a.type === "milestone" ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <ClipboardList className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">
                          <span className="font-semibold">{a.userName}</span>
                          <span className="text-muted-foreground"> · </span>
                          <span className="text-muted-foreground truncate">{a.projectName}</span>
                        </p>
                        <p className="text-sm text-foreground/90 mt-0.5 line-clamp-3 break-words min-h-[3.9em]">
                          {a.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(a.time), "MM/dd HH:mm")}
                          </span>
                          {a.extra && (
                            <Badge
                              variant="secondary"
                              className="rounded-full text-[9px] px-1.5 py-0"
                            >
                              {a.extra}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {activities.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={prev}
                  disabled={index === 0}
                  className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="上一条"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  {activities.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`跳转到第 ${i + 1} 条动态`}
                      onClick={() => {
                        setIndex(i);
                        scrollTo(i);
                      }}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={next}
                  disabled={index >= activities.length - 1}
                  className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="下一条"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project: p, dueLabel, avatarClass, onClick }: {
  project: DashboardProject; dueLabel: string; avatarClass: string; onClick: () => void;
}) {
  const lc = LIGHT_CONFIG[p.light];

  return (
    <Card className="hover-lift-lg shadow-soft rounded-2xl cursor-pointer" onClick={onClick}>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-3.5">
          <h3 className="font-semibold text-base leading-snug flex-1 pr-2">{p.name}</h3>
          <Badge variant="secondary" className={`rounded-full text-[11px] shrink-0 ${lc.color}`}>
            {lc.label}
          </Badge>
        </div>

        {/* Meta */}
        <div className="flex gap-4 text-xs text-muted-foreground mb-3.5">
          <span><strong className="font-semibold text-foreground">甲方</strong> {p.clientName}</span>
          {p.contractAmount && (
            <span><strong className="font-semibold text-foreground">合同额</strong> {p.contractAmount}万</span>
          )}
        </div>

        {/* Phase tag */}
        <Badge variant="secondary" className="rounded-full text-[11px] bg-accent text-accent-foreground">
          {PHASE_LABELS[p.phase]}
        </Badge>

        {/* Progress */}
        <div className="mt-3.5 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-600 ${
              p.light === "red"
                ? "bg-gradient-to-r from-destructive to-red-400"
                : p.light === "yellow"
                ? "bg-gradient-to-r from-warning to-warning-foreground"
                : "gradient-green"
            }`}
            style={{ width: `${p.progress}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-right mt-1.5">
          {p.milestoneStats.completed}/{p.milestoneStats.total} 节点 · {p.progress}%
        </p>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3.5 border-t border-border mt-3.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${avatarClass} flex items-center justify-center text-white text-xs font-semibold`}>
              {p.lead.name.charAt(0)}
            </div>
            <span className="text-[13px] font-medium">{p.lead.name}</span>
          </div>
          <span className={`text-xs ${p.light === "red" ? "text-destructive font-medium" : p.light === "yellow" ? "text-warning-foreground" : "text-muted-foreground"}`}>
            {p.nearestMilestone ? dueLabel : "-"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
