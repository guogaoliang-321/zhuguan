"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareWarning, Inbox } from "lucide-react";

interface Appeal {
  id: string;
  targetType: string;
  targetId: string;
  content: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  author: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: "待处理", cls: "bg-orange-100 text-orange-700" },
  accepted: { text: "已受理", cls: "bg-green-100 text-green-700" },
  rejected: { text: "已驳回", cls: "bg-red-100 text-red-700" },
  resolved: { text: "已处理", cls: "bg-blue-100 text-blue-700" },
};

const TARGET_LABELS: Record<string, string> = {
  task: "任务",
  worklog: "工时记录",
  score: "效能评分",
  task_status: "任务状态",
};

export default function MyAppealsPage() {
  const [items, setItems] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appeals")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Appeal[]) => setItems(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquareWarning className="w-7 h-7 text-orange-500" />
          我的申诉
        </h1>
        <p className="text-muted-foreground mt-1">
          已提交的申诉与处理结果
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
            还没有提交过申诉。在任务详情页可以"提出申诉"
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const sl = STATUS_LABELS[a.status] ?? STATUS_LABELS.pending;
            return (
              <Card key={a.id} className="shadow-soft rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sl.cls}`}>
                      {sl.text}
                    </span>
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {TARGET_LABELS[a.targetType] ?? a.targetType}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap mb-3">{a.content}</p>
                  {a.targetType === "task" && (
                    <Link href={`/tasks/${a.targetId}`} className="text-xs text-primary hover:underline">
                      查看申诉对象 →
                    </Link>
                  )}
                  {a.resolution && (
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <div className="font-medium text-foreground mb-1">
                        处理结果（{a.resolvedBy?.name}）
                      </div>
                      {a.resolution}
                      {a.resolvedAt && (
                        <span className="ml-2">
                          · {format(new Date(a.resolvedAt), "yyyy-MM-dd HH:mm")}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
