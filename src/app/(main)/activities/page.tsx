"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ClipboardList, MessageSquare, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem } from "@/app/api/activities/route";

type FilterKey = "all" | "note" | "worklog" | "milestone";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "note", label: "备注" },
  { key: "worklog", label: "工作记录" },
  { key: "milestone", label: "里程碑" },
];

export default function ActivitiesPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    fetch("/api/activities?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setActivities(data.activities ?? []);
        setLoading(false);
      });
  }, []);

  const filtered =
    filter === "all" ? activities : activities.filter((a) => a.type === filter);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">项目动态</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            全所最近更新的备注、工作记录与里程碑
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all shadow-soft ${
              filter === f.key
                ? "gradient-primary text-white shadow-primary"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            暂无动态
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((a) => (
            <Card
              key={a.id}
              className="shadow-soft rounded-2xl cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => router.push(`/projects/${a.projectId}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
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
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">{a.userName}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-muted-foreground">{a.projectName}</span>
                    </p>
                    <p className="text-sm text-foreground/80 mt-0.5 break-words">
                      {a.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(a.time), "yyyy/MM/dd HH:mm")}
                      </span>
                      {a.extra && (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] px-2 py-0"
                        >
                          {a.extra}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
