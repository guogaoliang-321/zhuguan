"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHASE_OPTIONS, STATUS_OPTIONS, PROJECT_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

interface User {
  id: string;
  name: string;
  position: string | null;
}

interface ProjectData {
  id?: string;
  name: string;
  contractNo: string;
  contractAmount: string;
  clientName: string;
  clientContact: string;
  projectType: string;
  phase: string;
  status: string;
  startDate: string;
  endDate: string;
  leadId: string;
  description: string;
  address: string;
  buildingArea: string;
}

const defaultData: ProjectData = {
  name: "",
  contractNo: "",
  contractAmount: "",
  clientName: "",
  clientContact: "",
  projectType: "",
  phase: "SCHEME",
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  leadId: "",
  description: "",
  address: "",
  buildingArea: "",
};

interface ProjectFormProps {
  initialData?: Partial<ProjectData> & { id?: string };
  isEdit?: boolean;
}

export function ProjectForm({ initialData, isEdit }: ProjectFormProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProjectData>({
    ...defaultData,
    ...initialData,
  });

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);

  function update(field: keyof ProjectData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const body = {
      name: data.name,
      contractNo: data.contractNo || null,
      contractAmount: data.contractAmount ? Number(data.contractAmount) : null,
      clientName: data.clientName,
      clientContact: data.clientContact || null,
      projectType: data.projectType || null,
      phase: data.phase,
      status: data.status,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      leadId: data.leadId,
      description: data.description || null,
      address: data.address || null,
      buildingArea: data.buildingArea ? Number(data.buildingArea) : null,
    };

    const url = isEdit ? `/api/projects/${initialData?.id}` : "/api/projects";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const project = await res.json();
      toast.success(isEdit ? "项目已更新" : "项目已创建");
      router.push(`/projects/${project.id}`);
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "操作失败");
    }

    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "编辑项目" : "新建项目"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEdit ? "修改项目信息" : "填写项目基本信息"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 max-w-4xl">
          {/* 基本信息 */}
          <Card className="shadow-soft rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>项目名称 *</Label>
                <Input
                  required
                  value={data.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="如：XX市中心医院门急诊楼"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>合同编号</Label>
                <Input
                  value={data.contractNo}
                  onChange={(e) => update("contractNo", e.target.value)}
                  placeholder="如：CNWD-2025-001"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>合同额（万元）</Label>
                <Input
                  type="number"
                  value={data.contractAmount}
                  onChange={(e) => update("contractAmount", e.target.value)}
                  placeholder="680"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>项目类型</Label>
                <Select
                  value={data.projectType}
                  onValueChange={(v) => v && update("projectType", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {PROJECT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>建筑面积（m²）</Label>
                <Input
                  type="number"
                  value={data.buildingArea}
                  onChange={(e) => update("buildingArea", e.target.value)}
                  placeholder="45000"
                  className="rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>项目地址</Label>
                <Input
                  value={data.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="省/市/区"
                  className="rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>项目简介</Label>
                <Textarea
                  value={data.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="简要描述项目内容..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* 甲方信息 */}
          <Card className="shadow-soft rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">甲方信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>甲方名称 *</Label>
                <Input
                  required
                  value={data.clientName}
                  onChange={(e) => update("clientName", e.target.value)}
                  placeholder="如：西安市卫健委"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>甲方联系人</Label>
                <Input
                  value={data.clientContact}
                  onChange={(e) => update("clientContact", e.target.value)}
                  placeholder="联系人姓名"
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* 项目状态 */}
          <Card className="shadow-soft rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">项目状态</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>设计阶段</Label>
                <Select
                  value={data.phase}
                  onValueChange={(v) => v && update("phase", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {PHASE_OPTIONS.find((o) => o.value === data.phase)?.label ?? data.phase}
                    </SelectValue>
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
                <Label>项目状态</Label>
                <Select
                  value={data.status}
                  onValueChange={(v) => v && update("status", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {STATUS_OPTIONS.find((o) => o.value === data.status)?.label ?? data.status}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>项目负责人 *</Label>
                <Select
                  value={data.leadId}
                  onValueChange={(v) => v && update("leadId", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择负责人">
                      {data.leadId
                        ? (() => {
                            const u = users.find((x) => x.id === data.leadId);
                            return u
                              ? `${u.name}${u.position ? ` · ${u.position}` : ""}`
                              : "选择负责人";
                          })()
                        : "选择负责人"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.position ? ` · ${u.position}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div className="space-y-2">
                <Label>开工日期</Label>
                <Input
                  type="date"
                  value={data.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>计划完成日期</Label>
                <Input
                  type="date"
                  value={data.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => router.back()}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="gradient-primary text-white shadow-primary rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "保存中..." : isEdit ? "保存修改" : "创建项目"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
