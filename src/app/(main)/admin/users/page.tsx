"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserPlus,
  Upload,
  Download,
  Search,
  Pencil,
  UserX,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ====== 常量 ======

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理员",
  PROJECT_LEAD: "项目负责人",
  MEMBER: "普通员工",
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  ADMIN: "bg-primary/10 text-primary",
  PROJECT_LEAD: "bg-[#00b894]/10 text-[#00b894]",
  MEMBER: "bg-muted text-muted-foreground",
};

const SPECIALTIES = [
  "建筑",
  "结构",
  "给排水",
  "暖通",
  "电气",
  "室内",
  "景观",
  "其他",
];

const ROLES = [
  { value: "ADMIN", label: "管理员" },
  { value: "PROJECT_LEAD", label: "项目负责人" },
  { value: "MEMBER", label: "普通员工" },
];

// ====== 类型 ======

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  specialty?: string | null;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  weeklyCapacity: number;
  createdAt: string;
}

interface CreateUserForm {
  username: string;
  password: string;
  name: string;
  role: string;
  phone: string;
  specialty: string;
  weeklyCapacity: number;
}

interface EditUserForm {
  name: string;
  role: string;
  phone: string;
  specialty: string;
  weeklyCapacity: number;
}

interface ImportPreviewRow {
  name: string;
  username: string;
  role: string;
  specialty?: string;
  phone?: string;
  status: "ok" | "error";
  error?: string;
}

// ====== 主页面 ======

export default function UsersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 新建用户弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: "",
    password: "",
    name: "",
    role: "MEMBER",
    phone: "",
    specialty: "",
    weeklyCapacity: 40,
  });
  const [createLoading, setCreateLoading] = useState(false);

  // 编辑弹窗
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    name: "",
    role: "MEMBER",
    phone: "",
    specialty: "",
    weeklyCapacity: 40,
  });
  const [editLoading, setEditLoading] = useState(false);

  // 停用确认弹窗
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // 导入弹窗
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importConfirmLoading, setImportConfirmLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 权限检查
  useEffect(() => {
    if (session && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [session, isAdmin, router]);

  // 加载用户列表
  function fetchUsers() {
    setLoading(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: User[]) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("加载用户列表失败");
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.includes(search) ||
      u.username.includes(search) ||
      u.specialty?.includes(search) ||
      u.phone?.includes(search)
  );

  // ====== 新建用户 ======

  function openCreate() {
    setCreateForm({
      username: "",
      password: "",
      name: "",
      role: "MEMBER",
      phone: "",
      specialty: "",
      weeklyCapacity: 40,
    });
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!createForm.username || !createForm.password || !createForm.name) {
      toast.error("请填写必填项：用户名、密码、姓名");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          weeklyCapacity: Number(createForm.weeklyCapacity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "创建失败");
        return;
      }
      toast.success(`用户 ${data.name} 创建成功`);
      setCreateOpen(false);
      fetchUsers();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setCreateLoading(false);
    }
  }

  // ====== 编辑用户 ======

  function openEdit(user: User) {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      phone: user.phone ?? "",
      specialty: user.specialty ?? "",
      weeklyCapacity: Number(user.weeklyCapacity),
    });
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editingUser) return;
    if (!editForm.name) {
      toast.error("姓名不能为空");
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          weeklyCapacity: Number(editForm.weeklyCapacity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "编辑失败");
        return;
      }
      toast.success(`用户 ${data.name} 已更新`);
      setEditOpen(false);
      fetchUsers();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setEditLoading(false);
    }
  }

  // ====== 停用用户 ======

  function openDeactivate(user: User) {
    setDeactivatingUser(user);
    setDeactivateOpen(true);
  }

  async function handleDeactivate() {
    if (!deactivatingUser) return;
    setDeactivateLoading(true);
    try {
      const res = await fetch(`/api/users/${deactivatingUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "停用失败");
        return;
      }
      toast.success(`用户 ${deactivatingUser.name} 已停用`);
      setDeactivateOpen(false);
      fetchUsers();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setDeactivateLoading(false);
    }
  }

  // ====== Excel 导入 ======

  function openImport() {
    setImportFile(null);
    setImportPreview(null);
    setImportOpen(true);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportLoading(true);
    setImportPreview(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "解析失败");
        setImportFile(null);
        return;
      }
      setImportPreview(data.preview ?? data);
    } catch {
      toast.error("文件解析失败，请重试");
      setImportFile(null);
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImportConfirmLoading(true);
    const fd = new FormData();
    fd.append("file", importFile);
    fd.append("confirm", "true");

    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "导入失败");
        return;
      }
      toast.success(`成功导入 ${data.imported ?? 0} 名用户`);
      setImportOpen(false);
      fetchUsers();
    } catch {
      toast.error("导入失败，请重试");
    } finally {
      setImportConfirmLoading(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const res = await fetch("/api/users/template");
      if (!res.ok) {
        toast.error("模板下载失败");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "用户导入模板.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("模板下载失败");
    }
  }

  // ====== 渲染 ======

  if (loading) {
    return (
      <div>
        <Skeleton className="h-9 w-48 rounded-xl mb-2" />
        <Skeleton className="h-5 w-64 rounded-lg mb-8" />
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl mb-2" />
        ))}
      </div>
    );
  }

  const okCount = importPreview?.filter((r) => r.status === "ok").length ?? 0;
  const errCount = importPreview?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div>
      {/* 页头 */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            管理系统账号、角色与专业方向
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={handleDownloadTemplate}
          >
            <Download className="w-4 h-4" />
            下载模板
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={openImport}
          >
            <Upload className="w-4 h-4" />
            批量导入
          </Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 gradient-primary text-white border-0 shadow-primary"
            onClick={openCreate}
          >
            <UserPlus className="w-4 h-4" />
            新建用户
          </Button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">总人数</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">管理员</p>
            <p className="text-2xl font-bold text-primary">
              {users.filter((u) => u.role === "ADMIN").length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">项目负责人</p>
            <p className="text-2xl font-bold text-[#00b894]">
              {users.filter((u) => u.role === "PROJECT_LEAD").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索 */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索姓名、用户名、专业..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-card border-0 shadow-soft h-10"
        />
      </div>

      {/* 用户表格 */}
      <Card className="shadow-soft rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-semibold">姓名</TableHead>
              <TableHead className="font-semibold">用户名</TableHead>
              <TableHead className="font-semibold">角色</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">专业</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">手机</TableHead>
              <TableHead className="font-semibold text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {search ? "没有匹配的用户" : "暂无用户"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((user) => (
              <TableRow key={user.id} className="hover:bg-accent/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.username}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`rounded-full text-xs ${ROLE_BADGE_CLASSES[user.role] ?? ""}`}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {user.specialty ?? "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {user.phone ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg hover:bg-accent"
                      title="编辑"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                      title="停用"
                      onClick={() => openDeactivate(user)}
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* 新建用户弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">
                  姓名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="c-name"
                  placeholder="真实姓名"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-username">
                  用户名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="c-username"
                  placeholder="登录用户名"
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, username: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-password">
                密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="c-password"
                type="password"
                placeholder="至少 6 位"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, password: e.target.value })
                }
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, role: v ?? createForm.role })
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>专业</Label>
                <Select
                  value={createForm.specialty}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, specialty: v ?? createForm.specialty })
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择专业" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">手机</Label>
                <Input
                  id="c-phone"
                  placeholder="手机号"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, phone: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-capacity">每周工时（h）</Label>
                <Input
                  id="c-capacity"
                  type="number"
                  min={1}
                  max={80}
                  value={createForm.weeklyCapacity}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      weeklyCapacity: Number(e.target.value),
                    })
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setCreateOpen(false)}
              disabled={createLoading}
            >
              取消
            </Button>
            <Button
              className="rounded-xl gradient-primary text-white border-0"
              onClick={handleCreate}
              disabled={createLoading}
            >
              {createLoading ? "创建中..." : "创建用户"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>编辑用户 · {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-name">姓名</Label>
              <Input
                id="e-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm({ ...editForm, role: v ?? editForm.role })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>专业</Label>
                <Select
                  value={editForm.specialty}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, specialty: v ?? editForm.specialty })
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="选择专业" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-phone">手机</Label>
                <Input
                  id="e-phone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-capacity">每周工时（h）</Label>
                <Input
                  id="e-capacity"
                  type="number"
                  min={1}
                  max={80}
                  value={editForm.weeklyCapacity}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      weeklyCapacity: Number(e.target.value),
                    })
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
            >
              取消
            </Button>
            <Button
              className="rounded-xl gradient-primary text-white border-0"
              onClick={handleEdit}
              disabled={editLoading}
            >
              {editLoading ? "保存中..." : "保存更改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 停用确认弹窗 */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              确认停用用户
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            停用后，<span className="font-semibold text-foreground">{deactivatingUser?.name}</span>{" "}
            将无法登录系统，但历史数据不会删除。确认继续？
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeactivateOpen(false)}
              disabled={deactivateLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={handleDeactivate}
              disabled={deactivateLoading}
            >
              {deactivateLoading ? "停用中..." : "确认停用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量导入弹窗 */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>批量导入用户</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* 上传区域 */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              {importFile ? (
                <p className="text-sm font-medium">{importFile.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">点击上传 Excel 文件</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    支持 .xlsx / .xls 格式
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {importLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-lg" />
                ))}
              </div>
            )}

            {/* 预览结果 */}
            {importPreview && !importLoading && (
              <div>
                <div className="flex items-center gap-3 mb-2 text-sm">
                  <span className="text-success font-medium">{okCount} 行可导入</span>
                  {errCount > 0 && (
                    <span className="text-destructive font-medium">{errCount} 行有错误</span>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">姓名</TableHead>
                        <TableHead className="text-xs">用户名</TableHead>
                        <TableHead className="text-xs">角色</TableHead>
                        <TableHead className="text-xs">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-1.5">{row.name}</TableCell>
                          <TableCell className="text-xs py-1.5">{row.username}</TableCell>
                          <TableCell className="text-xs py-1.5">
                            {ROLE_LABELS[row.role] ?? row.role}
                          </TableCell>
                          <TableCell className="text-xs py-1.5">
                            {row.status === "ok" ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full text-[10px] bg-success/10 text-success"
                              >
                                可导入
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="rounded-full text-[10px] bg-destructive/10 text-destructive"
                                title={row.error}
                              >
                                {row.error ?? "错误"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setImportOpen(false)}
              disabled={importConfirmLoading}
            >
              取消
            </Button>
            <Button
              className="rounded-xl gradient-primary text-white border-0"
              onClick={handleImportConfirm}
              disabled={!importPreview || okCount === 0 || importConfirmLoading}
            >
              {importConfirmLoading ? "导入中..." : `确认导入 ${okCount} 人`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
