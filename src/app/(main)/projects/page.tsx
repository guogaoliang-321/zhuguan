"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canCreateProject } from "@/lib/permissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search } from "lucide-react";
import { PHASE_LABELS, STATUS_LABELS, PHASE_OPTIONS, STATUS_OPTIONS } from "@/lib/constants";

interface Project {
  id: string;
  name: string;
  contractNo: string | null;
  contractAmount: number | null;
  clientName: string;
  projectType: string | null;
  phase: string;
  status: string;
  lead: { id: string; name: string };
  _count: { milestones: number; members: number };
}

export default function ProjectsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const mayCreate = session?.user
    ? canCreateProject({
        id: session.user.id,
        role: session.user.role,
      })
    : false;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (phaseFilter !== "all") params.set("phase", phaseFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/projects?${params}`);
    if (res.ok) {
      setProjects(await res.json());
    }
    setLoading(false);
  }, [search, phaseFilter, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const phaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      SCHEME: "bg-chart-1/10 text-chart-1",
      PRELIMINARY: "bg-chart-4/10 text-chart-4",
      CONSTRUCTION: "bg-chart-3/10 text-chart-3",
      COMPLETION: "bg-chart-5/10 text-chart-5",
    };
    return colors[phase] ?? "bg-muted text-muted-foreground";
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-success/10 text-success",
      PAUSED: "bg-warning/20 text-warning-foreground",
      COMPLETED: "bg-muted text-muted-foreground",
      ARCHIVED: "bg-muted text-muted-foreground",
    };
    return colors[status] ?? "";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目管理</h1>
          <p className="text-muted-foreground mt-1">
            共 {projects.length} 个项目
          </p>
        </div>
        {mayCreate && (
          <Link href="/projects/new">
            <Button className="gradient-primary text-white shadow-primary rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </Link>
        )}
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索项目名称、甲方、合同号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-card border-0 shadow-soft h-10"
          />
        </div>
        <Select value={phaseFilter} onValueChange={(v) => v && setPhaseFilter(v)}>
          <SelectTrigger className="w-[140px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue placeholder="设计阶段" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">全部阶段</SelectItem>
            {PHASE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[130px] rounded-xl bg-card border-0 shadow-soft h-10">
            <SelectValue placeholder="项目状态" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">全部状态</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <Card className="shadow-soft rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">项目名称</TableHead>
              <TableHead className="font-semibold">甲方</TableHead>
              <TableHead className="font-semibold">合同额(万)</TableHead>
              <TableHead className="font-semibold">阶段</TableHead>
              <TableHead className="font-semibold">状态</TableHead>
              <TableHead className="font-semibold">负责人</TableHead>
              <TableHead className="font-semibold text-center">成员</TableHead>
              <TableHead className="font-semibold text-center">节点</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full rounded-lg" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  暂无项目数据
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <TableCell className="font-medium max-w-[240px]">
                    <span className="truncate block">{project.name}</span>
                    {project.contractNo && (
                      <span className="text-xs text-muted-foreground">
                        {project.contractNo}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{project.clientName}</TableCell>
                  <TableCell>
                    {project.contractAmount
                      ? Number(project.contractAmount).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-xs ${phaseColor(project.phase)}`}
                    >
                      {PHASE_LABELS[project.phase]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-xs ${statusColor(project.status)}`}
                    >
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.lead.name}</TableCell>
                  <TableCell className="text-center">
                    {project._count.members}
                  </TableCell>
                  <TableCell className="text-center">
                    {project._count.milestones}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
