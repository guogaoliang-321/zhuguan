"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ListTodo,
  Clock,
  AlertTriangle,
  Zap,
  ArrowRight,
  CalendarClock,
} from "lucide-react";

interface TodayTask {
  id: string;
  name: string;
  status: string;
  priority: string;
  isInsertion: boolean;
  estimatedHours: number;
  plannedStart: string;
  plannedEnd: string;
  project: { id: string; name: string } | null;
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: "未开始", cls: "bg-muted text-muted-foreground" },
  in_progress: { text: "进行中", cls: "bg-blue-100 text-blue-700" },
  overdue: { text: "已逾期", cls: "bg-red-100 text-red-700" },
};

export function TodayTasksCard() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks?mine=1`)
      .then((r) => r.json())
      .then((data: TodayTask[]) => {
        const now = new Date();
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        // 今日任务 = 已开始（plannedStart <= todayEnd）且未完成且非已删除
        const todays = data.filter((t) => {
          if (t.status === "done") return false;
          return new Date(t.plannedStart) <= todayEnd;
        });
        // 排序：逾期 > 紧急 > 截止时间近
        todays.sort((a, b) => {
          if (a.status === "overdue" && b.status !== "overdue") return -1;
          if (b.status === "overdue" && a.status !== "overdue") return 1;
          if (a.priority === "urgent" && b.priority !== "urgent") return -1;
          if (b.priority === "urgent" && a.priority !== "urgent") return 1;
          return new Date(a.plannedEnd).getTime() - new Date(b.plannedEnd).getTime();
        });
        setTasks(todays);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-32 rounded-2xl mb-4 sm:mb-6" />;
  }

  if (tasks.length === 0) return null;

  const overdueCount = tasks.filter((t) => t.status === "overdue").length;

  return (
    <Card className="shadow-soft rounded-2xl mb-4 sm:mb-6">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ListTodo className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">我的今日任务</p>
              <p className="text-xs text-muted-foreground">
                {tasks.length} 个待办
                {overdueCount > 0 && (
                  <span className="text-red-600 font-medium ml-2">
                    · {overdueCount} 个已逾期
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/tasks"
            className="text-xs text-primary hover:underline inline-flex items-center"
          >
            全部任务 <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>

        <div className="space-y-2">
          {tasks.slice(0, 5).map((t) => {
            const sl = STATUS_LABELS[t.status] ?? STATUS_LABELS.pending;
            return (
              <Link key={t.id} href={`/tasks/${t.id}`}>
                <div
                  className={`px-3 py-2 rounded-xl border hover:bg-accent/40 transition-colors cursor-pointer ${
                    t.status === "overdue" ? "border-red-200 bg-red-50/40" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sl.cls}`}>
                      {sl.text}
                    </span>
                    {t.priority === "urgent" && (
                      <Badge variant="destructive" className="rounded-full text-[10px]">
                        <Zap className="w-3 h-3 mr-0.5" /> 紧急
                      </Badge>
                    )}
                    {t.isInsertion && (
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] border-orange-300 text-orange-600"
                      >
                        插队
                      </Badge>
                    )}
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">
                      {t.name}
                    </span>
                    {t.status === "overdue" && (
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {t.project && (
                      <span className="truncate max-w-[180px]">📂 {t.project.name}</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      预估 {Number(t.estimatedHours)}h
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      截止 {format(new Date(t.plannedEnd), "MM/dd HH:mm")}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {tasks.length > 5 && (
            <Link
              href="/tasks?mine=1"
              className="block text-center text-xs text-muted-foreground hover:text-primary py-1"
            >
              还有 {tasks.length - 5} 个 →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
