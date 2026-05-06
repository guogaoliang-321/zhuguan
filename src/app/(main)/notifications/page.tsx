"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Clock,
  ListTodo,
  Activity,
  Inbox,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  linkType: string | null;
  linkId: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  task_overdue_24h: AlertTriangle,
  not_confirmed_3d: Clock,
  overload: Activity,
  repeated_insertion: ListTodo,
};

const TYPE_COLOR: Record<string, string> = {
  task_overdue_24h: "text-red-600 bg-red-50",
  not_confirmed_3d: "text-orange-600 bg-orange-50",
  overload: "text-amber-600 bg-amber-50",
  repeated_insertion: "text-purple-600 bg-purple-50",
};

function buildLink(item: NotificationItem): string | null {
  if (!item.linkType || !item.linkId) return null;
  if (item.linkType === "task") return `/tasks/${item.linkId}`;
  if (item.linkType === "project") return `/projects/${item.linkId}`;
  if (item.linkType === "appeal") return `/admin/appeals#${item.linkId}`;
  return null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "unread">("unread");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (tab === "unread") sp.set("unread", "1");
    const res = await fetch(`/api/notifications?${sp}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function markAllRead() {
    const res = await fetch(`/api/notifications`, { method: "POST" });
    if (res.ok) {
      toast.success("全部标记已读");
      fetchItems();
    }
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    fetchItems();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> 站内消息
          </h1>
          <p className="text-muted-foreground mt-1">
            异常提醒与系统通知，每访问一次自动扫描最新规则命中
          </p>
        </div>
        <Button
          variant="outline"
          onClick={markAllRead}
          className="rounded-xl"
        >
          <CheckCheck className="w-4 h-4 mr-2" />
          全部已读
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("unread")}
          className="rounded-full"
        >
          未读
        </Button>
        <Button
          variant={tab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("all")}
          className="rounded-full"
        >
          全部
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
            {tab === "unread" ? "暂无未读通知" : "暂无通知"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            const colorCls = TYPE_COLOR[n.type] ?? "text-primary bg-primary/10";
            const href = buildLink(n);
            const inner = (
              <Card
                className={`shadow-soft rounded-2xl hover-lift cursor-pointer ${
                  !n.readAt ? "border-primary/30 bg-primary/[0.02]" : ""
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${colorCls} flex items-center justify-center shrink-0`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{n.title}</span>
                      {!n.readAt && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </p>
                  </div>
                  {href && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </CardContent>
              </Card>
            );
            if (href) {
              return (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => !n.readAt && markRead(n.id)}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <div key={n.id} onClick={() => !n.readAt && markRead(n.id)}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
