"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { WORK_CATEGORIES, WORK_CATEGORY_GROUPS } from "@/lib/constants";

const NON_PROJECT_VALUE = "__non_project__";

interface ProjectOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default function NewWorklogPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [nonProjectCategories, setNonProjectCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [isNonProject, setIsNonProject] = useState(false);
  const [nonProjectCategoryId, setNonProjectCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState("4");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectOption[]) => setProjects(data));
    fetchNonProjectCategories();
  }, []);

  function fetchNonProjectCategories() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CategoryOption[]) => setNonProjectCategories(data));
  }

  function handleProjectChange(value: string | null) {
    if (!value) return;
    if (value === NON_PROJECT_VALUE) {
      setIsNonProject(true);
      setProjectId("");
      setCategory("");
    } else {
      setIsNonProject(false);
      setProjectId(value);
      setNonProjectCategoryId("");
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      const cat: CategoryOption = await res.json();
      setNonProjectCategories((prev) =>
        [...prev, cat].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNonProjectCategoryId(cat.id);
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success("类别已创建");
    } else {
      const err = await res.json();
      toast.error(err.error || "创建失败");
    }
    setCreatingCategory(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const body = isNonProject
      ? { nonProjectCategoryId, date, hours: Number(hours), content }
      : { projectId, category, date, hours: Number(hours), content };

    const res = await fetch("/api/worklogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success("工作记录已提交");
      router.push("/worklog");
    } else {
      const err = await res.json();
      toast.error(err.error || "提交失败");
    }
    setLoading(false);
  }

  const canSubmit =
    !loading &&
    content.trim() &&
    Number(hours) >= 0.5 &&
    (isNonProject ? !!nonProjectCategoryId : !!(projectId && category));

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
          <h1 className="text-3xl font-bold tracking-tight">新增工作记录</h1>
          <p className="text-muted-foreground mt-1">记录今日工作内容</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card className="shadow-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">工作信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* 关联项目 / 非项目任务 */}
            <div className="space-y-2">
              <Label>关联项目 *</Label>
              <Select
                value={isNonProject ? NON_PROJECT_VALUE : projectId}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NON_PROJECT_VALUE} className="text-muted-foreground">
                    非项目任务
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 工作类别（项目模式）或 非项目类别（非项目模式） */}
            {!isNonProject ? (
              <div className="space-y-2">
                <Label>工作类别 *</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择类别" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[300px]">
                    {WORK_CATEGORY_GROUPS.map((group) => (
                      <SelectGroup key={group}>
                        <SelectLabel className="text-xs text-muted-foreground font-semibold">
                          {group}
                        </SelectLabel>
                        {WORK_CATEGORIES.filter((c) => c.group === group).map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>非项目类别 *</Label>
                {!showNewCategory ? (
                  <Select
                    value={nonProjectCategoryId}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v === "__new__") {
                        setShowNewCategory(true);
                        return;
                      }
                      setNonProjectCategoryId(v);
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="选择或新增类别" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {nonProjectCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value="__new__" className="text-primary font-medium">
                        <Plus className="w-3.5 h-3.5 mr-1.5 inline" />
                        新增类别
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="输入新类别名称（如：部门会议）"
                      className="rounded-xl flex-1"
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleCreateCategory())
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory}
                    >
                      确认
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      取消
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 日期 + 工时 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>工作日期 *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>投入工时（小时） *</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* 工作内容 */}
            <div className="space-y-2">
              <Label>工作内容 *</Label>
              <Textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="描述今天做了什么..."
                rows={4}
                className="rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
                disabled={!canSubmit}
                className="gradient-primary text-white shadow-primary rounded-xl"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? "提交中..." : "提交记录"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
