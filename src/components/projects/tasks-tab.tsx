"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  assignee: { id: string; name: string };
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: "未开始", cls: "bg-muted text-muted-foreground" },
  in_progress: { text: "进行中", cls: "bg-blue-100 text-blue-700" },
  done: { text: "已完成", cls: "bg-green-100 text-green-700" },
  overdue: { text: "已逾期", cls: "bg-red-100 text-red-700" },
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function TasksTab({ projectId, canEdit }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tasks?projectId=${projectId}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">项目任务</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              细粒度派活，可跟踪状态和工时偏差
            </p>
          </div>
          {canEdit && (
            <Link href={`/tasks/new?projectId=${projectId}`}>
              <Button size="sm" className="rounded-xl">
                <Plus className="w-3.5 h-3.5 mr-1" /> 新建任务
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            该项目下暂无任务{canEdit ? "，点击右上角创建" : ""}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => {
              const sl = STATUS_LABELS[t.status] ?? STATUS_LABELS.pending;
              return (
                <Link key={t.id} href={`/tasks/${t.id}`}>
                  <div
                    className={`px-4 py-3 rounded-xl border hover:bg-accent/40 transition-colors cursor-pointer ${
                      t.status === "overdue" ? "border-red-200 bg-red-50/40" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sl.cls}`}
                      >
                        {sl.text}
                      </span>
                      {t.priority === "urgent" && (
                        <Badge
                          variant="destructive"
                          className="rounded-full text-[10px]"
                        >
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
                      {t.specialty && (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px]"
                        >
                          {t.specialty}
                        </Badge>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {t.status === "overdue" && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        {t.status === "done" && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {t.assignee.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Number(t.estimatedHours)}h
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {format(new Date(t.plannedStart), "MM/dd")} –{" "}
                        {format(new Date(t.plannedEnd), "MM/dd")}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
