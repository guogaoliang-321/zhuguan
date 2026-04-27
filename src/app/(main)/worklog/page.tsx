"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
import { Plus, Trash2, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";

interface WorkLog {
  id: string;
  date: string;
  hours: number;
  content: string;
  category: string | null;
  confirmedAt: string | null;
  project: { id: string; name: string } | null;
  nonProjectCategory: { id: string; name: string } | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

export default function WorklogPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (projectFilter !== "all" && projectFilter !== "__non_project__") {
      params.set("projectId", projectFilter);
    }
    const res = await fetch(`/api/worklogs?${params}`);
    if (res.ok) {
      let data: WorkLog[] = await res.json();
      if (projectFilter === "__non_project__") {
        data = data.filter((l) => !l.project);
      }
      setLogs(data);
    }
    setLoading(false);
  }, [projectFilter]);

  useEffect(() => {
    fetchLogs();
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectOption[]) => setProjects(data));
  }, [fetchLogs]);

  async function handleDelete(id: string) {
    await fetch(`/api/worklogs/${id}`, { method: "DELETE" });
    toast.success("记录已删除");
    fetchLogs();
  }

  // 按日期分组
  const grouped = logs.reduce<Record<string, WorkLog[]>>((acc, log) => {
    const day = format(new Date(log.date), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(log);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">工作记录</h1>
          <p className="text-muted-foreground mt-1">记录每日工作内容</p>
        </div>
        <Link href="/worklog/new">
          <Button className="gradient-primary text-white shadow-primary rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            新增记录
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <Select value={projectFilter} onValueChange={(v) => v && setProjectFilter(v)}>
          <SelectTrigger className="w-[200px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue placeholder="按项目筛选" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">全部项目</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
            <SelectItem value="__non_project__">非项目任务</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            暂无工作记录，点击右上角"新增记录"开始
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayLogs]) => {
            const totalHours = dayLogs.reduce((sum, l) => sum + Number(l.hours), 0);
            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(new Date(date), "MM月dd日 EEEE")}
                  </div>
                  <Badge variant="secondary" className="rounded-full text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {totalHours}h
                  </Badge>
                </div>
                <div className="space-y-2">
                  {dayLogs.map((log) => (
                    <Card key={log.id} className="shadow-soft rounded-2xl hover-lift">
                      <CardContent className="py-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shrink-0">
                          {Number(log.hours)}h
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{log.content}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {log.project?.name ?? log.nonProjectCategory?.name ?? "非项目任务"}
                            </span>
                            {log.category && (
                              <Badge variant="secondary" className="rounded-full text-[10px]">
                                {log.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {log.confirmedAt && (
                          <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 rounded-full shrink-0">
                            已确认
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(log.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
