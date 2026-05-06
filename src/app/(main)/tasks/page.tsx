"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  CalendarClock,
  User as UserIcon,
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

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<string>("all");

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
        <Select value={scope} onValueChange={(v) => v && setScope(v as "mine" | "all")}>
          <SelectTrigger className="w-[160px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="mine">我的任务</SelectItem>
            <SelectItem value="all">全部可见</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <SelectTrigger className="w-[140px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">未开始</SelectItem>
            <SelectItem value="in_progress">进行中</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
            <SelectItem value="overdue">已逾期</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            {scope === "mine" ? "暂无分配给你的任务" : "暂无任务"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
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
