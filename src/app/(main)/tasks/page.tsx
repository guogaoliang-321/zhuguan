"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueLabeled,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  CalendarClock,
  User as UserIcon,
  Search,
} from "lucide-react";

interface TaskRow {
  id: string;
  name: string;
  status: string;
  priority: string;
  isInsertion: boolean;
  estimatedHours: number;
  plannedStart: string;
  plannedEnd: string;
  specialty: string | null;
  assignee: { id: string; name: string; specialty: string | null };
  project: { id: string; name: string } | null;
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: "未开始", cls: "bg-muted text-muted-foreground" },
  in_progress: { text: "进行中", cls: "bg-blue-100 text-blue-700" },
  done: { text: "已完成", cls: "bg-green-100 text-green-700" },
  overdue: { text: "已逾期", cls: "bg-red-100 text-red-700" },
};

type SortKey = "due" | "priority" | "hours";

const PRIORITY_RANK: Record<string, number> = { urgent: 0, normal: 1 };
const STATUS_RANK: Record<string, number> = {
  overdue: 0,
  in_progress: 1,
  pending: 2,
  done: 3,
};

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (scope === "mine") params.set("mine", "1");
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/tasks?${params}`);
    if (res.ok) {
      setTasks(await res.json());
    }
    setLoading(false);
  }, [scope, status]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const isPMOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "PROJECT_LEAD";

  // 责任人选项（来源于当前结果集）
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => map.set(t.assignee.id, t.assignee.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // 客户端搜索 + 排序 + 责任人过滤
  const visibleTasks = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (assigneeFilter !== "all" && t.assignee.id !== assigneeFilter) return false;
      if (!kw) return true;
      const hay = `${t.name} ${t.project?.name ?? ""} ${t.assignee.name}`.toLowerCase();
      return hay.includes(kw);
    });
    return filtered.sort((a, b) => {
      // 优先按状态：逾期/进行中/未开始/已完成
      const sa = STATUS_RANK[a.status] ?? 9;
      const sb = STATUS_RANK[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      if (sortKey === "due") {
        return new Date(a.plannedEnd).getTime() - new Date(b.plannedEnd).getTime();
      }
      if (sortKey === "priority") {
        const pa = PRIORITY_RANK[a.priority] ?? 9;
        const pb = PRIORITY_RANK[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return new Date(a.plannedEnd).getTime() - new Date(b.plannedEnd).getTime();
      }
      // hours: 工时降序
      return Number(b.estimatedHours) - Number(a.estimatedHours);
    });
  }, [tasks, keyword, sortKey, assigneeFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">任务管理</h1>
          <p className="text-muted-foreground mt-1">细粒度派活与状态跟踪</p>
        </div>
        {isPMOrAdmin && (
          <Link href="/tasks/new">
            <Button className="gradient-primary text-white shadow-primary rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              新建任务
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索任务名 / 项目"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9 rounded-xl bg-card border-0 shadow-soft h-10"
          />
        </div>
        <Select value={scope} onValueChange={(v) => v && setScope(v as "mine" | "all")}>
          <SelectTrigger className="w-[140px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValueLabeled
              value={scope}
              items={[
                { value: "mine", label: "我的任务" },
                { value: "all", label: "全部可见" },
              ]}
            />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="mine">我的任务</SelectItem>
            <SelectItem value="all">全部可见</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <SelectTrigger className="w-[120px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValueLabeled
              value={status}
              items={[
                { value: "all", label: "全部状态" },
                { value: "pending", label: "未开始" },
                { value: "in_progress", label: "进行中" },
                { value: "done", label: "已完成" },
                { value: "overdue", label: "已逾期" },
              ]}
              placeholder="全部状态"
            />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">未开始</SelectItem>
            <SelectItem value="in_progress">进行中</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
            <SelectItem value="overdue">已逾期</SelectItem>
          </SelectContent>
        </Select>
        {scope === "all" && assigneeOptions.length > 0 && (
          <Select value={assigneeFilter} onValueChange={(v) => v && setAssigneeFilter(v)}>
            <SelectTrigger className="w-[140px] rounded-xl bg-card border-0 shadow-soft h-10">
              <SelectValueLabeled
                value={assigneeFilter}
                items={[
                  { value: "all", label: "全部责任人" },
                  ...assigneeOptions.map((a) => ({ value: a.id, label: a.name })),
                ]}
                placeholder="全部责任人"
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              <SelectItem value="all">全部责任人</SelectItem>
              {assigneeOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortKey} onValueChange={(v) => v && setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[140px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValueLabeled
              value={sortKey}
              items={[
                { value: "due", label: "截止时间近" },
                { value: "priority", label: "优先级" },
                { value: "hours", label: "工时大" },
              ]}
            />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="due">截止时间近</SelectItem>
            <SelectItem value="priority">优先级</SelectItem>
            <SelectItem value="hours">工时大</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">
          {loading ? "" : `共 ${visibleTasks.length} 条`}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : visibleTasks.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            {keyword || assigneeFilter !== "all" || status !== "all"
              ? "没有匹配的任务，试试换个关键词或筛选条件"
              : scope === "mine"
                ? "暂无分配给你的任务"
                : "暂无任务"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((t) => {
            const sl = STATUS_LABELS[t.status] ?? STATUS_LABELS.pending;
            const overdue = t.status === "overdue";
            return (
              <Link key={t.id} href={`/tasks/${t.id}`}>
                <Card
                  className={`shadow-soft rounded-2xl hover-lift cursor-pointer ${
                    overdue ? "ring-1 ring-red-200" : ""
                  }`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sl.cls}`}>
                            {sl.text}
                          </span>
                          {t.priority === "urgent" && (
                            <Badge variant="destructive" className="rounded-full text-[10px]">
                              <Zap className="w-3 h-3 mr-0.5" />
                              紧急
                            </Badge>
                          )}
                          {t.isInsertion && (
                            <Badge variant="outline" className="rounded-full text-[10px] border-orange-300 text-orange-600">
                              插队
                            </Badge>
                          )}
                          {t.specialty && (
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              {t.specialty}
                            </Badge>
                          )}
                        </div>
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5" />
                            {t.assignee.name}
                          </span>
                          {t.project && (
                            <span className="truncate max-w-[200px]">
                              📂 {t.project.name}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {Number(t.estimatedHours)}h
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {format(new Date(t.plannedStart), "MM/dd")} – {format(new Date(t.plannedEnd), "MM/dd")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {overdue ? (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        ) : t.status === "done" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
