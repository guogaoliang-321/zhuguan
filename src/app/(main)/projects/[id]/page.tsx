"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit,
  Plus,
  Trash2,
  CalendarDays,
  Building2,
  Users,
  MapPin,
} from "lucide-react";
import { PHASE_LABELS, STATUS_LABELS, PHASE_OPTIONS } from "@/lib/constants";
import { canEditProject } from "@/lib/permissions";

interface Milestone {
  id: string;
  name: string;
  phase: string;
  description: string | null;
  dueDate: string;
  completedAt: string | null;
  isCompleted: boolean;
  sortOrder: number;
  assignee: { id: string; name: string } | null;
}

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; position: string | null; department: string | null };
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
}

interface UserOption {
  id: string;
  name: string;
  position: string | null;
}

interface Project {
  id: string;
  name: string;
  contractNo: string | null;
  contractAmount: number | null;
  clientName: string;
  clientContact: string | null;
  projectType: string | null;
  phase: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  leadId: string;
  lead: { id: string; name: string; position: string | null };
  description: string | null;
  address: string | null;
  buildingArea: number | null;
  milestones: Milestone[];
  members: Member[];
  notes: Note[];
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProject(await res.json());
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers);
  }, [fetchProject]);

  const canEdit =
    session?.user && project
      ? canEditProject(
          { id: session.user.id, role: session.user.role },
          { leadId: project.leadId }
        )
      : false;

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => router.push("/projects")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge
                variant="secondary"
                className="rounded-full bg-accent text-accent-foreground"
              >
                {PHASE_LABELS[project.phase]}
              </Badge>
              <Badge
                variant="secondary"
                className="rounded-full bg-success/10 text-success"
              >
                {STATUS_LABELS[project.status]}
              </Badge>
              {project.contractNo && (
                <span className="text-sm text-muted-foreground">
                  {project.contractNo}
                </span>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Link href={`/projects/${id}/edit`}>
            <Button variant="outline" className="rounded-xl">
              <Edit className="w-4 h-4 mr-2" />
              编辑
            </Button>
          </Link>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <InfoCard
          icon={<Building2 className="w-4 h-4" />}
          label="甲方"
          value={project.clientName}
        />
        <InfoCard
          icon={<Users className="w-4 h-4" />}
          label="负责人"
          value={project.lead.name}
        />
        <InfoCard
          icon={<CalendarDays className="w-4 h-4" />}
          label="合同额"
          value={
            project.contractAmount
              ? `${Number(project.contractAmount).toLocaleString()} 万`
              : "-"
          }
        />
        <InfoCard
          icon={<MapPin className="w-4 h-4" />}
          label="建筑面积"
          value={
            project.buildingArea
              ? `${Number(project.buildingArea).toLocaleString()} m²`
              : "-"
          }
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="milestones">
        <TabsList className="rounded-xl bg-card shadow-soft mb-6 p-1">
          <TabsTrigger value="milestones" className="rounded-lg">
            设计节点 ({project.milestones.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-lg">
            项目成员 ({project.members.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg">
            项目备注 ({project.notes.length})
          </TabsTrigger>
          <TabsTrigger value="workload" className="rounded-lg">
            工时贡献
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg">
            待确认
            {pendingCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info" className="rounded-lg">
            基本信息
          </TabsTrigger>
        </TabsList>

        <TabsContent value="milestones">
          <MilestonesTab
            projectId={id}
            milestones={project.milestones}
            phase={project.phase}
            users={users}
            canEdit={canEdit}
            onRefresh={fetchProject}
          />
        </TabsContent>

        <TabsContent value="members">
          <MembersTab
            projectId={id}
            members={project.members}
            users={users}
            canEdit={canEdit}
            onRefresh={fetchProject}
          />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab
            projectId={id}
            notes={project.notes}
            onRefresh={fetchProject}
          />
        </TabsContent>

        <TabsContent value="workload">
          <WorkloadTab projectId={id} />
        </TabsContent>

        <TabsContent value="pending">
          <PendingConfirmTab projectId={id} canConfirm={canEdit} onCountChange={setPendingCount} />
        </TabsContent>

        <TabsContent value="info">
          <Card className="shadow-soft rounded-2xl">
            <CardContent className="pt-6 space-y-4">
              <InfoRow label="项目名称" value={project.name} />
              <InfoRow label="合同编号" value={project.contractNo} />
              <InfoRow label="甲方联系人" value={project.clientContact} />
              <InfoRow label="项目类型" value={project.projectType} />
              <InfoRow label="项目地址" value={project.address} />
              <InfoRow label="项目简介" value={project.description} />
              <InfoRow
                label="开工日期"
                value={
                  project.startDate
                    ? format(new Date(project.startDate), "yyyy-MM-dd")
                    : null
                }
              />
              <InfoRow
                label="计划完成"
                value={
                  project.endDate
                    ? format(new Date(project.endDate), "yyyy-MM-dd")
                    : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====== Sub Components ======

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="font-semibold text-sm truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  );
}

// ====== Milestones Tab ======

function MilestonesTab({
  projectId,
  milestones,
  phase,
  users,
  canEdit,
  onRefresh,
}: {
  projectId: string;
  milestones: Milestone[];
  phase: string;
  users: UserOption[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [msPhase, setMsPhase] = useState(phase);
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  async function handleCreate() {
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phase: msPhase,
        dueDate,
        assigneeId: assigneeId || null,
      }),
    });
    if (res.ok) {
      toast.success("节点已创建");
      setOpen(false);
      setName("");
      setDueDate("");
      setAssigneeId("");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  async function toggleComplete(ms: Milestone) {
    await fetch(
      `/api/projects/${projectId}/milestones/${ms.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !ms.isCompleted }),
      }
    );
    onRefresh();
  }

  async function deleteMilestone(msId: string) {
    await fetch(
      `/api/projects/${projectId}/milestones/${msId}`,
      { method: "DELETE" }
    );
    toast.success("节点已删除");
    onRefresh();
  }

  const now = new Date();

  function milestoneStatus(ms: Milestone) {
    if (ms.isCompleted) return { label: "已完成", color: "bg-success/10 text-success" };
    const due = new Date(ms.dueDate);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return { label: "已逾期", color: "bg-destructive/10 text-destructive" };
    if (diff <= 3) return { label: "即将到期", color: "bg-warning/20 text-warning-foreground" };
    return { label: "正常", color: "bg-success/10 text-success" };
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <>
        <Button
          variant="outline"
          className="rounded-xl mb-2"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          添加节点
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>添加设计节点</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>节点名称 *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：方案汇报"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>所属阶段</Label>
                  <Select value={msPhase} onValueChange={(v) => v && setMsPhase(v)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {PHASE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>截止日期 *</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>负责人</Label>
                <Select value={assigneeId} onValueChange={(v) => v && setAssigneeId(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择负责人" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!name || !dueDate}
                className="w-full gradient-primary text-white rounded-xl"
              >
                创建节点
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </>
      )}

      {milestones.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无设计节点
          </CardContent>
        </Card>
      ) : (
        milestones.map((ms) => {
          const status = milestoneStatus(ms);
          return (
            <Card
              key={ms.id}
              className="shadow-soft rounded-2xl hover-lift"
            >
              <CardContent className="py-4 flex items-center gap-4">
                <Checkbox
                  checked={ms.isCompleted}
                  onCheckedChange={() => toggleComplete(ms)}
                  className="rounded-md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-sm ${ms.isCompleted ? "line-through text-muted-foreground" : ""}`}
                    >
                      {ms.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-[10px] px-2 ${status.color}`}
                    >
                      {status.label}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-full text-[10px] px-2"
                    >
                      {PHASE_LABELS[ms.phase]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>截止: {format(new Date(ms.dueDate), "yyyy-MM-dd")}</span>
                    {ms.assignee && <span>负责人: {ms.assignee.name}</span>}
                    {ms.completedAt && (
                      <span>
                        完成: {format(new Date(ms.completedAt), "yyyy-MM-dd")}
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMilestone(ms.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ====== Members Tab ======

function MembersTab({
  projectId,
  members,
  users,
  canEdit,
  onRefresh,
}: {
  projectId: string;
  members: Member[];
  users: UserOption[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");

  const existingIds = new Set(members.map((m) => m.user.id));
  const availableUsers = users.filter((u) => !existingIds.has(u.id));

  async function handleAdd() {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) {
      toast.success("成员已添加");
      setOpen(false);
      setUserId("");
      setRole("");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  async function removeMember(memberId: string) {
    await fetch(
      `/api/projects/${projectId}/members/${memberId}`,
      { method: "DELETE" }
    );
    toast.success("成员已移除");
    onRefresh();
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <>
        <Button
          variant="outline"
          className="rounded-xl mb-2"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          添加成员
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>添加项目成员</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>选择成员 *</Label>
                <Select value={userId} onValueChange={(v) => v && setUserId(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择人员" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.position ? ` · ${u.position}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>项目角色 *</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="如：建筑专业负责人"
                  className="rounded-xl"
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={!userId || !role}
                className="w-full gradient-primary text-white rounded-xl"
              >
                添加成员
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </>
      )}

      {members.length === 0 ? (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无项目成员
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <Card key={m.id} className="shadow-soft rounded-2xl">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {m.user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.role}
                    {m.user.position ? ` · ${m.user.position}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember(m.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== Notes Tab ======

function NotesTab({
  projectId,
  notes,
  onRefresh,
}: {
  projectId: string;
  notes: Note[];
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setContent("");
      onRefresh();
    }
    setPosting(false);
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="pt-4 pb-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="添加项目备注..."
            rows={3}
            className="rounded-xl border-0 bg-muted/50 mb-3"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!content.trim() || posting}
              onClick={handlePost}
              className="gradient-primary text-white rounded-xl"
            >
              发布备注
            </Button>
          </div>
        </CardContent>
      </Card>

      {notes.map((note) => (
        <Card key={note.id} className="shadow-soft rounded-2xl">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full gradient-pink flex items-center justify-center text-white text-xs font-semibold">
                {note.author.name.charAt(0)}
              </div>
              <span className="text-sm font-medium">{note.author.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(note.createdAt), "MM-dd HH:mm")}
              </span>
            </div>
            <p className="text-sm pl-9">{note.content}</p>
          </CardContent>
        </Card>
      ))}

      {notes.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">
          暂无备注
        </p>
      )}
    </div>
  );
}

// ===== 待确认工作记录 Tab =====

function PendingConfirmTab({
  projectId,
  canConfirm,
  onCountChange,
}: {
  projectId: string;
  canConfirm: boolean;
  onCountChange: (n: number) => void;
}) {
  const [logs, setLogs] = useState<
    {
      id: string;
      date: string;
      hours: number;
      content: string;
      category: string | null;
      confirmedAt: string | null;
      user: { id: string; name: string };
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/worklogs?projectId=${projectId}`);
    if (res.ok) {
      const all = await res.json();
      const pending = all.filter((l: { confirmedAt: string | null }) => !l.confirmedAt);
      setLogs(pending);
      onCountChange(pending.length);
    }
    setLoading(false);
  }, [projectId, onCountChange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handleConfirm(id: string) {
    setConfirming(id);
    const res = await fetch(`/api/worklogs/${id}/confirm`, { method: "POST" });
    if (res.ok) {
      toast.success("已确认");
      fetchLogs();
    } else {
      toast.error("确认失败");
    }
    setConfirming(null);
  }

  if (loading) return <Skeleton className="h-40 rounded-2xl" />;

  if (logs.length === 0) {
    return (
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          暂无待确认记录
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id} className="shadow-soft rounded-2xl">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-xs shrink-0">
              {Number(log.hours)}h
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{log.content}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{log.user.name}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.date), "MM-dd")}
                </span>
                {log.category && (
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {log.category}
                  </Badge>
                )}
              </div>
            </div>
            {canConfirm && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-green-600 border-green-200 hover:bg-green-50 shrink-0"
                disabled={confirming === log.id}
                onClick={() => handleConfirm(log.id)}
              >
                ✓ 确认
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== 工时贡献 Tab =====
interface ProjectWorkloadMember {
  userId: string;
  name: string;
  position: string | null;
  role: string;
  isLead: boolean;
  totalHours: number;
  logCount: number;
  byCategory: { category: string; hours: number }[];
}
interface ProjectWorkloadResp {
  totalHours: number;
  logCount: number;
  members: ProjectWorkloadMember[];
}

function WorkloadTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectWorkloadResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/workload`)
      .then((r) => r.json())
      .then((d: ProjectWorkloadResp) => {
        setData(d);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-2xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data || data.members.length === 0) {
    return (
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="py-16 text-center text-muted-foreground">
          本项目还没有工时记录
        </CardContent>
      </Card>
    );
  }

  const maxHours = Math.max(1, ...data.members.map((m) => m.totalHours));

  return (
    <div>
      <Card className="shadow-soft rounded-2xl mb-4">
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground">累计总工时</div>
            <div className="text-2xl font-bold tracking-tight">
              {data.totalHours}
              <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">累计记录数</div>
            <div className="text-2xl font-bold tracking-tight">
              {data.logCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">条</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">参与成员</div>
            <div className="text-2xl font-bold tracking-tight">
              {data.members.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">人</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.members.map((m) => {
          const pct = (m.totalHours / maxHours) * 100;
          const share =
            data.totalHours > 0
              ? Math.round((m.totalHours / data.totalHours) * 100)
              : 0;
          return (
            <Card key={m.userId} className="shadow-soft rounded-2xl">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full gradient-primary text-white flex items-center justify-center text-xs font-semibold">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {m.name}
                        {m.isLead && (
                          <Badge
                            variant="secondary"
                            className="rounded-full text-[10px] ml-2 px-1.5 py-0 bg-primary/10 text-primary"
                          >
                            负责人
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {m.role}
                        {m.position ? ` · ${m.position}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{m.totalHours}h</div>
                    <div className="text-[11px] text-muted-foreground">
                      {share}% · {m.logCount} 条
                    </div>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full gradient-primary rounded-full transition-all"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                {m.byCategory.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.byCategory.slice(0, 6).map((c) => (
                      <Badge
                        key={c.category}
                        variant="secondary"
                        className="rounded-full text-[10px] px-1.5 py-0"
                      >
                        {c.category} {c.hours}h
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
