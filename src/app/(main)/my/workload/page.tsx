"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parse } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, FolderKanban, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MineSummary } from "@/app/api/worklogs/mine/route";

const BAR_COLORS = [
  "bg-[#6c5ce7]",
  "bg-[#00b894]",
  "bg-[#fd79a8]",
  "bg-[#fdcb6e]",
  "bg-[#0984e3]",
  "bg-[#e17055]",
  "bg-[#00cec9]",
  "bg-[#a29bfe]",
];

function monthLabel(monthStr: string): string {
  const d = parse(monthStr, "yyyy-MM", new Date());
  return format(d, "yyyy 年 M 月", { locale: zhCN });
}

function shiftMonth(monthStr: string, delta: number): string {
  const d = parse(monthStr, "yyyy-MM", new Date());
  d.setMonth(d.getMonth() + delta);
  return format(d, "yyyy-MM");
}

export default function MyWorkloadPage() {
  const router = useRouter();
  const [month, setMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<MineSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worklogs/mine?month=${month}`)
      .then((r) => r.json())
      .then((d: MineSummary) => {
        setData(d);
        setLoading(false);
      });
  }, [month]);

  const maxWeek = useMemo(
    () => Math.max(1, ...((data?.byWeek ?? []).map((w) => w.hours))),
    [data]
  );
  const maxProject = useMemo(
    () => Math.max(1, ...((data?.byProject ?? []).map((p) => p.hours))),
    [data]
  );
  const maxCategory = useMemo(
    () => Math.max(1, ...((data?.byCategory ?? []).map((c) => c.hours))),
    [data]
  );

  const daysInMonth = useMemo(() => {
    const d = parse(month, "yyyy-MM", new Date());
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }, [month]);

  const isCurrentMonth = month === format(new Date(), "yyyy-MM");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">我的工作量</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            本月统计与历史趋势，数据仅含你本人
          </p>
        </div>
        <Link href="/worklog/new">
          <Button className="gradient-primary text-white shadow-primary rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            写工作记录
          </Button>
        </Link>
      </div>

      {/* 本周未填提醒 */}
      {!loading && data && isCurrentMonth && !data.thisWeekFilled && (
        <Card className="shadow-soft rounded-2xl mb-5 border-warning/40 bg-warning/5">
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-warning-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">本周还没填工作记录</p>
                <p className="text-xs text-muted-foreground">
                  及时补录能让你的工时统计更准确
                </p>
              </div>
            </div>
            <Link href="/worklog/new">
              <Button size="sm" variant="outline" className="rounded-xl shrink-0">
                去补录
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Month picker */}
      <Card className="shadow-soft rounded-2xl mb-5">
        <CardContent className="py-3 flex items-center justify-between gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="上个月"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <div className="text-lg font-semibold">{monthLabel(month)}</div>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setMonth(format(new Date(), "yyyy-MM"))}
                className="text-xs text-primary hover:underline mt-0.5"
              >
                回到本月
              </button>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="下个月"
            disabled={isCurrentMonth}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </CardContent>
      </Card>

      {/* Stats + 饱和度环 */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 mb-5">
        <SaturationRing
          saturation={data?.saturation ?? 0}
          totalHours={data?.totalHours ?? 0}
          loading={loading}
        />
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="本月工时"
            value={loading ? "—" : `${data?.totalHours ?? 0}`}
            suffix="h"
            big
          />
          <Stat
            label="填报天数"
            value={loading ? "—" : `${data?.daysLogged ?? 0}`}
            suffix={`/${data?.workDaysInMonth ?? daysInMonth}`}
          />
          <Stat
            label="工时/天"
            value={
              loading
                ? "—"
                : data && data.daysLogged > 0
                  ? (Math.round((data.totalHours / data.daysLogged) * 10) / 10).toString()
                  : "0"
            }
            suffix="h"
          />
        </div>
      </div>

      {/* 按周走势 */}
      <Card className="shadow-soft rounded-2xl mb-5">
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold mb-3">按周工时</h3>
          {loading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : !data || data.byWeek.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">本月无数据</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-32">
              {data.byWeek.map((w, i) => {
                const pct = (w.hours / maxWeek) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  >
                    <div className="text-[11px] font-medium text-foreground/80 h-4">
                      {w.hours > 0 ? w.hours : ""}
                    </div>
                    <div className="w-full h-[80px] flex items-end">
                      <div
                        className="w-full rounded-t-lg gradient-primary transition-all"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {format(new Date(w.weekStart), "M/d")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 按项目 & 按类别 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">按项目</h3>
              <span className="text-[11px] text-muted-foreground">
                {data?.byProject.length ?? 0} 个
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : !data || data.byProject.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">暂无数据</p>
            ) : (
              <div className="space-y-2.5">
                {data.byProject.slice(0, 8).map((p, i) => {
                  const pct = (p.hours / maxProject) * 100;
                  const color = BAR_COLORS[i % BAR_COLORS.length];
                  return (
                    <button
                      key={p.projectId}
                      type="button"
                      onClick={() => router.push(`/projects/${p.projectId}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="truncate font-medium group-hover:text-primary">
                          {p.projectName}
                        </span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {p.hours}h
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">按类别</h3>
              <span className="text-[11px] text-muted-foreground">
                {data?.byCategory.length ?? 0} 类
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : !data || data.byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">暂无数据</p>
            ) : (
              <div className="space-y-2.5">
                {data.byCategory.slice(0, 8).map((c, i) => {
                  const pct = (c.hours / maxCategory) * 100;
                  const color = BAR_COLORS[(i + 3) % BAR_COLORS.length];
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="truncate font-medium">{c.category}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {c.hours}h
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近记录 */}
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">最近记录</h3>
            <Link
              href="/worklog"
              className="text-xs text-primary hover:underline"
            >
              全部记录
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : !data || data.recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">本月还没填记录</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentLogs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => router.push(`/projects/${l.projectId}`)}
                  className="w-full text-left flex items-start gap-3 p-2 rounded-xl hover:bg-accent/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-semibold">
                    {l.hours}h
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {l.projectName}
                      </span>
                      {l.category && (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] px-1.5 py-0"
                        >
                          {l.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 line-clamp-2 mt-0.5">
                      {l.content}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(l.date), "yyyy/MM/dd EEE", { locale: zhCN })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SaturationRing({
  saturation,
  totalHours,
  loading,
}: {
  saturation: number;
  totalHours: number;
  loading: boolean;
}) {
  // 环颜色分级
  const level =
    saturation >= 110
      ? { color: "#e17055", bg: "bg-destructive/10", label: "超载", labelClass: "text-destructive" }
      : saturation >= 85
        ? { color: "#00b894", bg: "bg-success/10", label: "饱满", labelClass: "text-success" }
        : saturation >= 50
          ? { color: "#6c5ce7", bg: "bg-primary/10", label: "正常", labelClass: "text-primary" }
          : { color: "#fdcb6e", bg: "bg-warning/20", label: "偏低", labelClass: "text-warning-foreground" };

  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(saturation, 100);
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="py-4 px-4 flex items-center gap-4 md:flex-col md:items-center md:justify-center md:w-[180px]">
        <div className="relative" style={{ width: size, height: size }}>
          {loading ? (
            <Skeleton className="rounded-full" style={{ width: size, height: size }} />
          ) : (
            <>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={level.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight">{saturation}</span>
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </>
          )}
        </div>
        <div className="md:text-center">
          <div className="text-xs text-muted-foreground mb-0.5">饱和度</div>
          <Badge
            variant="secondary"
            className={`rounded-full text-[11px] ${level.bg} ${level.labelClass}`}
          >
            {level.label}
          </Badge>
          <div className="text-[10px] text-muted-foreground mt-1">
            {totalHours}h 已填报
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  suffix,
  big,
}: {
  label: string;
  value: string;
  suffix?: string;
  big?: boolean;
}) {
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="py-3 px-3 sm:px-4">
        <div className="text-[11px] text-muted-foreground mb-0.5 truncate">
          {label}
        </div>
        <div className="flex items-baseline gap-0.5">
          <span
            className={
              big
                ? "text-2xl sm:text-3xl font-bold tracking-tight"
                : "text-xl sm:text-2xl font-bold tracking-tight"
            }
          >
            {value}
          </span>
          {suffix && (
            <span className="text-xs text-muted-foreground">{suffix}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
