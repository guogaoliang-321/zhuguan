"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Activity, Info } from "lucide-react";

interface Cell {
  weekStart: string;
  estimatedHours: number;
  utilization: number;
  taskIds: string[];
}

interface Row {
  userId: string;
  name: string;
  specialty: string | null;
  weeklyCapacity: number;
  cells: Cell[];
}

interface HeatmapData {
  weekStarts: string[];
  rows: Row[];
}

function colorClass(util: number): string {
  if (util > 90) return "bg-red-100 text-red-700 ring-red-200";
  if (util >= 70) return "bg-amber-100 text-amber-700 ring-amber-200";
  if (util > 0) return "bg-green-100 text-green-700 ring-green-200";
  return "bg-muted/40 text-muted-foreground ring-border";
}

export default function HeatmapPage() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState("4");
  const [forbidden, setForbidden] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tasks/heatmap?weeks=${weeks}`);
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [weeks]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (forbidden) {
    return (
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="py-16 text-center text-muted-foreground">
          仅管理员或项目负责人可查看团队热力图
        </CardContent>
      </Card>
    );
  }

  // 按专业分组
  const grouped = (data?.rows ?? []).reduce<Record<string, Row[]>>((acc, r) => {
    const k = r.specialty ?? "未分专业";
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" />
            团队负荷热力图
          </h1>
          <p className="text-muted-foreground mt-1">
            未来 N 周每人预估工时 / 标准工时（饱和度）
          </p>
        </div>
        <Select value={weeks} onValueChange={(v) => v && setWeeks(v)}>
          <SelectTrigger className="w-[120px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="2">2 周</SelectItem>
            <SelectItem value="4">4 周</SelectItem>
            <SelectItem value="8">8 周</SelectItem>
            <SelectItem value="12">12 周</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-6">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 ring-1 ring-green-200" />
          &lt; 70%（充裕）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-100 ring-1 ring-amber-200" />
          70–90%（饱和）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 ring-1 ring-red-200" />
          &gt; 90%（过载）
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data || data.rows.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            未来 {weeks} 周内暂无任务
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-soft rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left font-medium px-4 py-3 sticky left-0 bg-muted/40 min-w-[140px]">
                      人员
                    </th>
                    {data.weekStarts.map((w) => {
                      const start = new Date(w);
                      const end = new Date(w);
                      end.setDate(start.getDate() + 6);
                      return (
                        <th
                          key={w}
                          className="text-center font-medium px-2 py-3 min-w-[110px]"
                        >
                          <div className="text-xs">
                            {format(start, "MM/dd")}–{format(end, "MM/dd")}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([specialty, rows]) => (
                    <>
                      <tr key={`g-${specialty}`} className="bg-accent/30">
                        <td
                          colSpan={data.weekStarts.length + 1}
                          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-1.5"
                        >
                          {specialty}
                        </td>
                      </tr>
                      {rows.map((r) => (
                        <tr key={r.userId} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-2 sticky left-0 bg-card">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              标准工时 {r.weeklyCapacity}h/周
                            </div>
                          </td>
                          {r.cells.map((c) => (
                            <td key={c.weekStart} className="px-2 py-2">
                              <Popover>
                                <PopoverTrigger
                                  className={`w-full rounded-lg ring-1 px-2 py-1.5 text-xs font-medium ${colorClass(c.utilization)} hover:scale-105 transition-transform`}
                                >
                                  <div className="font-semibold">
                                    {c.utilization}%
                                  </div>
                                  <div className="text-[10px] opacity-75">
                                    {c.estimatedHours}h
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 rounded-xl">
                                  <div className="text-sm font-medium mb-1">
                                    {r.name} ·{" "}
                                    {format(new Date(c.weekStart), "MM/dd")} 周
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-2">
                                    工时 {c.estimatedHours}h / {r.weeklyCapacity}h（{c.utilization}%）
                                  </div>
                                  {c.taskIds.length > 0 ? (
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium">本周任务（{c.taskIds.length}）</div>
                                      {c.taskIds.slice(0, 5).map((id) => (
                                        <Link
                                          key={id}
                                          href={`/tasks/${id}`}
                                          className="block text-xs text-primary hover:underline truncate"
                                        >
                                          → 查看任务
                                        </Link>
                                      ))}
                                      {c.taskIds.length > 5 && (
                                        <div className="text-[11px] text-muted-foreground">
                                          ... 还有 {c.taskIds.length - 5} 个
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                      <Info className="w-3 h-3" /> 本周无派工
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
