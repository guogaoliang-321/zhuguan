"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, differenceInBusinessDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

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

export default function AdminAppealsPage() {
  const [items, setItems] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reviewing, setReviewing] = useState<Appeal | null>(null);
  const [decision, setDecision] = useState<"accepted" | "rejected" | "resolved">("resolved");
  const [resolution, setResolution] = useState("");
  const [acting, setActing] = useState(false);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (statusFilter !== "all") sp.set("status", statusFilter);
    const res = await fetch(`/api/appeals?${sp}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  async function handleReview() {
    if (!reviewing) return;
    if (!resolution.trim()) return toast.error("请填写处理结果");
    setActing(true);
    const res = await fetch(`/api/appeals/${reviewing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: decision, resolution: resolution.trim() }),
    });
    if (res.ok) {
      toast.success("已处理");
      setReviewing(null);
      setResolution("");
      fetchAppeals();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "处理失败");
    }
    setActing(false);
  }

  function targetLink(a: Appeal): string | null {
    if (a.targetType === "task") return `/tasks/${a.targetId}`;
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="w-7 h-7 text-orange-500" />
            申诉处理
          </h1>
          <p className="text-muted-foreground mt-1">
            员工对任务/工时/评分的异议，3 个工作日内必须反馈
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[140px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="accepted">已受理</SelectItem>
            <SelectItem value="rejected">已驳回</SelectItem>
            <SelectItem value="resolved">已处理</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
            {statusFilter === "pending" ? "目前没有待处理的申诉" : "暂无申诉"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const sl = STATUS_LABELS[a.status] ?? STATUS_LABELS.pending;
            const days = differenceInBusinessDays(new Date(), new Date(a.createdAt));
            const overdue = a.status === "pending" && days >= 3;
            return (
              <Card
                key={a.id}
                id={a.id}
                className={`shadow-soft rounded-2xl ${overdue ? "ring-1 ring-red-200" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sl.cls}`}>
                      {sl.text}
                    </span>
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {TARGET_LABELS[a.targetType] ?? a.targetType}
                    </Badge>
                    {overdue && (
                      <Badge variant="destructive" className="rounded-full text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-0.5" /> 超 3 工作日
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {a.author.name} ·{" "}
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: zhCN })}
                    </span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap mb-3">{a.content}</p>

                  {targetLink(a) && (
                    <Link
                      href={targetLink(a)!}
                      className="text-xs text-primary hover:underline"
                    >
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

                  {a.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setReviewing(a);
                          setDecision("accepted");
                          setResolution("");
                        }}
                        className="rounded-xl bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> 受理
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewing(a);
                          setDecision("rejected");
                          setResolution("");
                        }}
                        className="rounded-xl"
                      >
                        <XCircle className="w-4 h-4 mr-1.5" /> 驳回
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(v) => !v && setReviewing(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision === "accepted" ? "受理申诉" : decision === "rejected" ? "驳回申诉" : "处理申诉"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select
              value={decision}
              onValueChange={(v) => v && setDecision(v as "accepted" | "rejected" | "resolved")}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="accepted">受理（同意申诉）</SelectItem>
                <SelectItem value="rejected">驳回（不同意）</SelectItem>
                <SelectItem value="resolved">已处理（其他）</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="请说明处理结果，会同步通知申诉人"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} className="rounded-xl">
              取消
            </Button>
            <Button disabled={acting} onClick={handleReview} className="rounded-xl">
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
