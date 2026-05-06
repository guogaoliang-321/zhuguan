"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Inbox } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string };
}

const ACTION_LABELS: Record<string, { text: string; cls: string }> = {
  user_anonymize: { text: "用户离职清退", cls: "bg-red-100 text-red-700" },
  user_role_change: { text: "改用户角色", cls: "bg-purple-100 text-purple-700" },
  user_password_reset: { text: "重置密码", cls: "bg-amber-100 text-amber-700" },
  user_create: { text: "新建用户", cls: "bg-green-100 text-green-700" },
  user_deactivate: { text: "停用用户", cls: "bg-zinc-100 text-zinc-700" },
  project_delete: { text: "删除项目", cls: "bg-red-100 text-red-700" },
  task_force_change: { text: "强改任务", cls: "bg-amber-100 text-amber-700" },
  task_delete: { text: "删除任务", cls: "bg-red-100 text-red-700" },
  worklog_admin_edit: { text: "管理员改工时", cls: "bg-amber-100 text-amber-700" },
  worklog_admin_delete: { text: "管理员删工时", cls: "bg-red-100 text-red-700" },
  appeal_resolve: { text: "处理申诉", cls: "bg-blue-100 text-blue-700" },
  credentials_setup: { text: "批量改账号", cls: "bg-purple-100 text-purple-700" },
  data_purge: { text: "清空数据", cls: "bg-red-100 text-red-700" },
  misc: { text: "其他", cls: "bg-muted text-muted-foreground" },
};

function fmtJson(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (actionFilter !== "all") sp.set("action", actionFilter);
    const res = await fetch(`/api/admin/audit-logs?${sp}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [actionFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            审计日志
          </h1>
          <p className="text-muted-foreground mt-1">
            管理员对敏感数据的所有修改留痕，按时间倒序
          </p>
        </div>
        <Select value={actionFilter} onValueChange={(v) => v && setActionFilter(v)}>
          <SelectTrigger className="w-[160px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">全部动作</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.text}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
            暂无审计记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((log) => {
            const al = ACTION_LABELS[log.action] ?? ACTION_LABELS.misc;
            return (
              <Card key={log.id} className="shadow-soft rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${al.cls}`}>
                      {al.text}
                    </span>
                    {log.targetType && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {log.targetType}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {log.actor.name} · {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                  </div>
                  {log.targetId && (
                    <div className="text-xs text-muted-foreground font-mono mb-2">
                      target: {log.targetId}
                    </div>
                  )}
                  {(log.before || log.after) && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-medium mb-1 text-muted-foreground">改前</div>
                        <pre className="bg-muted/40 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {fmtJson(log.before)}
                        </pre>
                      </div>
                      <div>
                        <div className="font-medium mb-1 text-muted-foreground">改后</div>
                        <pre className="bg-muted/40 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {fmtJson(log.after)}
                        </pre>
                      </div>
                    </div>
                  )}
                  {log.meta && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      备注：<code className="font-mono">{fmtJson(log.meta)}</code>
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
