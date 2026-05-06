"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Zap } from "lucide-react";

const SPECIALTIES = ["建筑", "结构", "给排水", "暖通", "电气", "智能化", "总图", "其他"];

interface ProjectOption {
  id: string;
  name: string;
  members: { user: { id: string; name: string; specialty: string | null } }[];
  lead: { id: string; name: string; specialty: string | null };
}

export default function NewTaskPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetProjectId = sp.get("projectId") ?? "";

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Step 1：项目
  const [projectId, setProjectId] = useState(presetProjectId);
  // Step 2：任务详情
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [isInsertion, setIsInsertion] = useState(false);
  const [insertionReason, setInsertionReason] = useState("");
  // Step 3：工时与时间
  const [estimatedHours, setEstimatedHours] = useState("4");
  const [plannedStart, setPlannedStart] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [plannedEnd, setPlannedEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });

  useEffect(() => {
    fetch("/api/projects?include=members")
      .then((r) => r.json())
      .then((data: ProjectOption[]) => setProjects(data))
      .catch(() => setProjects([]));
  }, []);

  const currentProject = projects.find((p) => p.id === projectId);
  const memberOptions = currentProject
    ? [
        { id: currentProject.lead.id, name: currentProject.lead.name + "（负责人）", specialty: currentProject.lead.specialty },
        ...currentProject.members
          .filter((m) => m.user.id !== currentProject.lead.id)
          .map((m) => m.user),
      ]
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("请填写任务名称");
    if (!assigneeId) return toast.error("请选择责任人");
    if (Number(estimatedHours) < 0.5) return toast.error("预估工时至少 0.5 小时");
    if (new Date(plannedEnd) <= new Date(plannedStart))
      return toast.error("结束时间必须晚于开始时间");
    if (isInsertion && !insertionReason.trim())
      return toast.error("插队任务必须填写原因");

    setLoading(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        projectId: projectId || null,
        specialty: specialty || null,
        assigneeId,
        estimatedHours: Number(estimatedHours),
        priority,
        isInsertion,
        insertionReason: isInsertion ? insertionReason.trim() : null,
        plannedStart: new Date(plannedStart).toISOString(),
        plannedEnd: new Date(plannedEnd).toISOString(),
      }),
    });

    if (res.ok) {
      const task = await res.json();
      toast.success("任务已创建");
      router.push(`/tasks/${task.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "创建失败");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/tasks" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回任务列表
        </Link>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-1">新建任务</h1>
      <p className="text-muted-foreground mb-8">三步搞定：项目 → 任务详情 → 工时与时间</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1 */}
        <Card className="shadow-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">1. 所属项目</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(!v || v === "__none__" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="__none__">非项目任务</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className="shadow-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">2. 任务详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">任务名称 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：医院 A 楼方案文本初稿"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选，任务背景或注意事项"
                className="rounded-xl"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>专业</Label>
                <Select value={specialty || "__any__"} onValueChange={(v) => setSpecialty(!v || v === "__any__" ? "" : v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="不指定" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="__any__">不指定</SelectItem>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>责任人 *</Label>
                <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "")} disabled={!projectId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={projectId ? "选择责任人" : "先选项目"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {memberOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}{u.specialty ? `（${u.specialty}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={priority} onValueChange={(v) => v && setPriority(v as "normal" | "urgent")}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="normal">常规</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={isInsertion} onCheckedChange={setIsInsertion} id="insertion" />
                  <Label htmlFor="insertion" className="cursor-pointer flex items-center gap-1">
                    <Zap className="w-4 h-4 text-orange-500" />
                    插队任务
                  </Label>
                </div>
              </div>
            </div>

            {isInsertion && (
              <div className="space-y-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
                <Label htmlFor="reason" className="text-orange-900">插队原因 *</Label>
                <Textarea
                  id="reason"
                  value={insertionReason}
                  onChange={(e) => setInsertionReason(e.target.value)}
                  placeholder="例：甲方临时要求优先推进"
                  className="rounded-xl bg-white"
                  rows={2}
                />
                <p className="text-xs text-orange-700">
                  ⚡ 系统会自动顺延该责任人的所有未开始任务
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card className="shadow-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">3. 工时与时间</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hours">预估工时（小时）*</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                💡 建议在最小估算基础上 +10–15% 缓冲
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">计划开始 *</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">计划结束 *</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={plannedEnd}
                  onChange={(e) => setPlannedEnd(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={loading}
            className="gradient-primary text-white shadow-primary rounded-xl"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "提交中..." : "创建任务"}
          </Button>
          <Link href="/tasks">
            <Button type="button" variant="outline" className="rounded-xl">
              取消
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
