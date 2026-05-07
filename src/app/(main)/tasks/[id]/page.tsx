"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueLabeled,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Clock,
  CalendarClock,
  User as UserIcon,
  Zap,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  History,
  Trash2,
  Pencil,
  MessageSquareWarning,
} from "lucide-react";
import { toast } from "sonner";

interface StatusLog {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedAt: string;
  changedBy: { id: string; name: string };
}

interface WorkLogItem {
  id: string;
  date: string;
  hours: number;
  content: string;
  user: { id: string; name: string };
}

interface TaskDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  isInsertion: boolean;
  insertionReason: string | null;
  estimatedHours: number;
  specialty: string | null;
  plannedStart: string;
  plannedEnd: string;
  completedAt: string | null;
  pmConfirmedAt: string | null;
  assignee: { id: string; name: string; specialty: string | null };
  createdBy: { id: string; name: string };
  project: { id: string; name: string; leadId: string } | null;
  milestone: { id: string; name: string; phase: string } | null;
  statusLogs: StatusLog[];
  workLogs: WorkLogItem[];
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  pending: { text: "未开始", cls: "bg-muted text-muted-foreground" },
  in_progress: { text: "进行中", cls: "bg-blue-100 text-blue-700" },
  done: { text: "已完成", cls: "bg-green-100 text-green-700" },
  overdue: { text: "已逾期", cls: "bg-red-100 text-red-700" },
  deleted: { text: "已删除", cls: "bg-zinc-200 text-zinc-700" },
};

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [delayReason, setDelayReason] = useState("");
  const [showDelay, setShowDelay] = useState(false);
  const [acting, setActing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealContent, setAppealContent] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    estimatedHours: "0",
    priority: "normal" as "normal" | "urgent",
    plannedStart: "",
    plannedEnd: "",
    assigneeId: "",
  });
  const [memberOptions, setMemberOptions] = useState<
    { id: string; name: string; specialty: string | null }[]
  >([]);

  const fetchTask = useCallback(async () => {
    const res = await fetch(`/api/tasks/${id}`);
    if (res.ok) {
      setTask(await res.json());
    } else if (res.status === 403) {
      toast.error("无权访问该任务");
      router.push("/tasks");
    } else if (res.status === 404) {
      toast.error("任务不存在");
      router.push("/tasks");
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  async function changeStatus(toStatus: string, reason?: string) {
    setActing(true);
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason: reason ?? null }),
    });
    if (res.ok) {
      toast.success("状态已更新");
      setShowDelay(false);
      setDelayReason("");
      await fetchTask();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "操作失败");
    }
    setActing(false);
  }

  async function pmConfirm(approve: boolean, reason?: string) {
    setActing(true);
    const res = await fetch(`/api/tasks/${id}/pm-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, reason: reason ?? null }),
    });
    if (res.ok) {
      toast.success(approve ? "已确认完成" : "已退回，需重做");
      await fetchTask();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "操作失败");
    }
    setActing(false);
  }

  async function handleDelete() {
    if (!confirm("确认删除该任务？将留痕但不可恢复。")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("任务已删除");
      router.push("/tasks");
    } else {
      toast.error("删除失败");
    }
  }

  async function openEditDialog() {
    if (!task) return;
    setEditForm({
      name: task.name,
      estimatedHours: String(Number(task.estimatedHours)),
      priority: task.priority as "normal" | "urgent",
      plannedStart: new Date(task.plannedStart).toISOString().slice(0, 16),
      plannedEnd: new Date(task.plannedEnd).toISOString().slice(0, 16),
      assigneeId: task.assignee.id,
    });
    // 拉项目成员（含 lead）填责任人下拉
    if (task.project) {
      try {
        const res = await fetch(`/api/projects?include=members`);
        const all = await res.json();
        const proj = all.find((p: { id: string }) => p.id === task.project!.id);
        if (proj) {
          const members = [
            { id: proj.lead.id, name: proj.lead.name + "（负责人）", specialty: proj.lead.specialty },
            ...proj.members
              .filter((m: { user: { id: string } }) => m.user.id !== proj.lead.id)
              .map((m: { user: { id: string; name: string; specialty: string | null } }) => m.user),
          ];
          setMemberOptions(members);
        }
      } catch {
        setMemberOptions([{ id: task.assignee.id, name: task.assignee.name, specialty: task.assignee.specialty }]);
      }
    }
    setEditOpen(true);
  }

  async function submitAppeal() {
    if (appealContent.trim().length < 5) return toast.error("申诉理由至少 5 个字");
    setActing(true);
    const res = await fetch(`/api/appeals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "task",
        targetId: id,
        content: appealContent.trim(),
      }),
    });
    if (res.ok) {
      toast.success("申诉已提交，管理员将在 3 个工作日内反馈");
      setAppealOpen(false);
      setAppealContent("");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "提交失败");
    }
    setActing(false);
  }

  async function submitEdit() {
    const hours = Number(editForm.estimatedHours);
    if (!editForm.name.trim()) return toast.error("任务名称不能为空");
    if (hours < 0.5) return toast.error("预估工时至少 0.5 小时");
    if (new Date(editForm.plannedEnd) <= new Date(editForm.plannedStart))
      return toast.error("结束时间必须晚于开始时间");

    setActing(true);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        estimatedHours: hours,
        priority: editForm.priority,
        plannedStart: new Date(editForm.plannedStart).toISOString(),
        plannedEnd: new Date(editForm.plannedEnd).toISOString(),
        assigneeId: editForm.assigneeId,
      }),
    });
    if (res.ok) {
      toast.success("任务已更新");
      setEditOpen(false);
      await fetchTask();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "更新失败");
    }
    setActing(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (!task) return null;

  const sl = STATUS_LABELS[task.status] ?? STATUS_LABELS.pending;
  const isAssignee = session?.user?.id === task.assignee.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const isProjectLead =
    session?.user?.role === "PROJECT_LEAD" &&
    task.project?.leadId === session.user.id;
  const canEdit = isAdmin || isProjectLead;
  const canMarkDone = isAssignee || isAdmin;
  const canPMConfirm = canEdit;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回任务列表
        </Link>
      </div>

      {/* 头部信息 */}
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sl.cls}`}
            >
              {sl.text}
            </span>
            {task.priority === "urgent" && (
              <Badge variant="destructive" className="rounded-full">
                <Zap className="w-3 h-3 mr-1" /> 紧急
              </Badge>
            )}
            {task.isInsertion && (
              <Badge
                variant="outline"
                className="rounded-full border-orange-300 text-orange-600"
              >
                插队
              </Badge>
            )}
            {task.specialty && (
              <Badge variant="secondary" className="rounded-full">
                {task.specialty}
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold mb-2">{task.name}</h1>
          {task.description && (
            <p className="text-muted-foreground text-sm mb-4 whitespace-pre-wrap">
              {task.description}
            </p>
          )}
          {task.isInsertion && task.insertionReason && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm text-orange-900 mb-4">
              <span className="font-medium">插队原因：</span>
              {task.insertionReason}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground mb-1">责任人</div>
              <div className="flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-primary" />
                <span className="font-medium">{task.assignee.name}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">预估工时</div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {Number(task.estimatedHours)} h
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">计划起止</div>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {format(new Date(task.plannedStart), "MM/dd HH:mm")} –{" "}
                  {format(new Date(task.plannedEnd), "MM/dd HH:mm")}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">所属项目</div>
              <div className="font-medium truncate">
                {task.project ? (
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="text-primary hover:underline"
                  >
                    {task.project.name}
                  </Link>
                ) : (
                  "非项目任务"
                )}
              </div>
            </div>
          </div>

          {task.pmConfirmedAt && (
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              PM 已确认完成 ·{" "}
              {format(new Date(task.pmConfirmedAt), "yyyy-MM-dd HH:mm")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作区 */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {task.status === "pending" && canMarkDone && (
              <Button
                disabled={acting}
                onClick={() => changeStatus("in_progress")}
                className="rounded-xl"
              >
                <PlayCircle className="w-4 h-4 mr-2" /> 开始任务
              </Button>
            )}
            {(task.status === "in_progress" || task.status === "overdue") &&
              canMarkDone && (
                <Button
                  disabled={acting}
                  onClick={() => changeStatus("done")}
                  className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> 标记完成
                </Button>
              )}
            {task.status !== "done" && task.status !== "overdue" && canEdit && (
              <Button
                disabled={acting}
                onClick={() => setShowDelay((v) => !v)}
                variant="outline"
                className="rounded-xl"
              >
                <AlertTriangle className="w-4 h-4 mr-2" /> 报告延期
              </Button>
            )}
            {task.status === "done" && !task.pmConfirmedAt && canPMConfirm && (
              <>
                <Button
                  disabled={acting}
                  onClick={() => pmConfirm(true)}
                  className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> PM 确认完成
                </Button>
                <Button
                  disabled={acting}
                  onClick={() => {
                    const reason = prompt("请说明退回原因");
                    if (reason) pmConfirm(false, reason);
                  }}
                  variant="outline"
                  className="rounded-xl"
                >
                  <XCircle className="w-4 h-4 mr-2" /> 退回重做
                </Button>
              </>
            )}
            <div className="ml-auto flex gap-2">
              {/* 申诉：任何登录用户对任务有异议都可提交 */}
              <Button
                onClick={() => setAppealOpen(true)}
                variant="ghost"
                className="rounded-xl text-orange-600 hover:bg-orange-50"
              >
                <MessageSquareWarning className="w-4 h-4 mr-2" /> 提出申诉
              </Button>
              {canEdit && (
                <>
                  <Button
                    onClick={openEditDialog}
                    variant="outline"
                    className="rounded-xl"
                  >
                    <Pencil className="w-4 h-4 mr-2" /> 编辑
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="ghost"
                    className="rounded-xl text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> 删除
                  </Button>
                </>
              )}
            </div>
          </div>

          {showDelay && (
            <div className="space-y-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <Textarea
                placeholder="说明延期原因（必填，例：甲方反馈延迟、资源冲突）"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={2}
                className="rounded-xl bg-white"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!delayReason.trim() || acting}
                  onClick={() => changeStatus("overdue", delayReason.trim())}
                  className="rounded-xl"
                >
                  确认延期
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowDelay(false);
                    setDelayReason("");
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 状态时间线 */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> 状态时间线
          </CardTitle>
        </CardHeader>
        <CardContent>
          {task.statusLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无状态变更记录</p>
          ) : (
            <div className="space-y-3">
              {task.statusLogs.map((log) => {
                const fromLabel = log.fromStatus
                  ? STATUS_LABELS[log.fromStatus]?.text ?? log.fromStatus
                  : "新建";
                const toLabel =
                  STATUS_LABELS[log.toStatus]?.text ?? log.toStatus;
                return (
                  <div
                    key={log.id}
                    className="flex gap-3 pb-3 border-b last:border-0 last:pb-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{log.changedBy.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {fromLabel} → {toLabel}
                        </span>
                      </div>
                      {log.reason && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {log.reason}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(log.changedAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 关联工时 */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">关联工时记录</CardTitle>
        </CardHeader>
        <CardContent>
          {task.workLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无工时记录。员工在「工作记录」里关联到此任务后将显示在这里。
            </p>
          ) : (
            <div className="space-y-2">
              {task.workLogs.map((wl) => (
                <div
                  key={wl.id}
                  className="flex items-center gap-3 py-2 border-b last:border-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-xs font-bold">
                    {Number(wl.hours)}h
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{wl.content}</div>
                    <div className="text-xs text-muted-foreground">
                      {wl.user.name} · {format(new Date(wl.date), "yyyy-MM-dd")}
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-sm font-medium">
                合计实际工时：
                {task.workLogs
                  .reduce((s, w) => s + Number(w.hours), 0)
                  .toFixed(1)}{" "}
                h / 预估 {Number(task.estimatedHours)} h
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>任务名称</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            {memberOptions.length > 0 && (
              <div className="space-y-2">
                <Label>责任人</Label>
                <Select
                  value={editForm.assigneeId}
                  onValueChange={(v) => v && setEditForm((f) => ({ ...f, assigneeId: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValueLabeled
                      value={editForm.assigneeId}
                      items={memberOptions.map((m) => ({
                        value: m.id,
                        label: `${m.name}${m.specialty ? `（${m.specialty}）` : ""}`,
                      }))}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {memberOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.specialty ? `（${m.specialty}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>预估工时（h）</Label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={editForm.estimatedHours}
                  onChange={(e) => setEditForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(v) =>
                    v && setEditForm((f) => ({ ...f, priority: v as "normal" | "urgent" }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValueLabeled
                      value={editForm.priority}
                      items={[
                        { value: "normal", label: "常规" },
                        { value: "urgent", label: "紧急" },
                      ]}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="normal">常规</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>计划开始</Label>
                <Input
                  type="datetime-local"
                  value={editForm.plannedStart}
                  onChange={(e) => setEditForm((f) => ({ ...f, plannedStart: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>计划结束</Label>
                <Input
                  type="datetime-local"
                  value={editForm.plannedEnd}
                  onChange={(e) => setEditForm((f) => ({ ...f, plannedEnd: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">
              取消
            </Button>
            <Button disabled={acting} onClick={submitEdit} className="rounded-xl">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 申诉 Dialog */}
      <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-orange-500" />
              对该任务提出申诉
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              管理员会在 3 个工作日内核实并反馈。处理结果会通过站内消息通知你。
            </p>
            <Textarea
              placeholder="请详细说明申诉理由（至少 5 个字）..."
              value={appealContent}
              onChange={(e) => setAppealContent(e.target.value)}
              rows={5}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealOpen(false)} className="rounded-xl">
              取消
            </Button>
            <Button disabled={acting} onClick={submitAppeal} className="rounded-xl">
              提交申诉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
