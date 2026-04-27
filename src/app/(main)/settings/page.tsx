"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, User, Lock, Clock } from "lucide-react";
import { toast } from "sonner";

// ====== 常量 ======

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理员",
  PROJECT_LEAD: "项目负责人",
  MEMBER: "普通员工",
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

// ====== 类型 ======

interface UserDetail {
  id: string;
  name: string;
  username: string;
  role: string;
  phone?: string | null;
  specialty?: string | null;
  weeklyCapacity: number;
}

// ====== 主页面 ======

export default function SettingsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 基本信息
  const [infoForm, setInfoForm] = useState({ phone: "", specialty: "" });
  const [infoLoading, setInfoLoading] = useState(false);

  // 修改密码
  const [pwForm, setPwForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwLoading, setPwLoading] = useState(false);

  // 工时设置
  const [capacityValue, setCapacityValue] = useState(40);
  const [capacityLoading, setCapacityLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((data: UserDetail) => {
        setUserDetail(data);
        setInfoForm({
          phone: data.phone ?? "",
          specialty: data.specialty ?? "",
        });
        setCapacityValue(Number(data.weeklyCapacity));
        setLoading(false);
      })
      .catch(() => {
        toast.error("加载用户信息失败");
        setLoading(false);
      });
  }, [userId]);

  // ====== 保存基本信息 ======

  async function handleSaveInfo() {
    if (!userId) return;
    setInfoLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: infoForm.phone,
          specialty: infoForm.specialty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "保存失败");
        return;
      }
      toast.success("基本信息已更新");
      setUserDetail((prev) =>
        prev
          ? { ...prev, phone: infoForm.phone, specialty: infoForm.specialty }
          : prev
      );
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setInfoLoading(false);
    }
  }

  // ====== 修改密码 ======

  async function handleChangePassword() {
    if (!userId) return;
    if (!pwForm.newPassword || pwForm.newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("两次密码不一致");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "修改失败");
        return;
      }
      toast.success("密码已修改，下次登录生效");
      setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setPwLoading(false);
    }
  }

  // ====== 保存工时设置 ======

  async function handleSaveCapacity() {
    if (!userId) return;
    if (!capacityValue || capacityValue < 1 || capacityValue > 80) {
      toast.error("每周工时应在 1～80 小时之间");
      return;
    }
    setCapacityLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyCapacity: capacityValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "保存失败");
        return;
      }
      toast.success("工时设置已更新");
      setUserDetail((prev) =>
        prev ? { ...prev, weeklyCapacity: capacityValue } : prev
      );
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setCapacityLoading(false);
    }
  }

  // ====== 渲染 ======

  if (loading || !userDetail) {
    return (
      <div className="max-w-xl">
        <Skeleton className="h-9 w-32 rounded-xl mb-2" />
        <Skeleton className="h-5 w-56 rounded-lg mb-8" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl mb-4" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">个人设置</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          管理你的账号信息与偏好
        </p>
      </div>

      {/* 基本信息卡片 */}
      <Card className="shadow-soft rounded-2xl mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">基本信息</h2>
          </div>

          {/* 只读字段 */}
          <div className="grid grid-cols-2 gap-3 mb-4 p-3.5 bg-muted/30 rounded-xl">
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">姓名</p>
              <p className="text-sm font-medium">{userDetail.name}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">用户名</p>
              <p className="text-sm font-medium">{userDetail.username}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">角色</p>
              <p className="text-sm font-medium">
                {ROLE_LABELS[userDetail.role] ?? userDetail.role}
              </p>
            </div>
          </div>

          {/* 可编辑字段 */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">手机号</Label>
              <Input
                id="s-phone"
                placeholder="请输入手机号"
                value={infoForm.phone}
                onChange={(e) =>
                  setInfoForm({ ...infoForm, phone: e.target.value })
                }
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>专业方向</Label>
              <Select
                value={infoForm.specialty}
                onValueChange={(v) =>
                  setInfoForm({ ...infoForm, specialty: v ?? infoForm.specialty })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="选择专业方向" />
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

          <Button
            className="mt-4 rounded-xl gradient-primary text-white border-0 w-full sm:w-auto"
            onClick={handleSaveInfo}
            disabled={infoLoading}
          >
            {infoLoading ? "保存中..." : "保存基本信息"}
          </Button>
        </CardContent>
      </Card>

      {/* 修改密码卡片 */}
      <Card className="shadow-soft rounded-2xl mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">修改密码</h2>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">新密码</Label>
              <Input
                id="pw-new"
                type="password"
                placeholder="至少 6 位"
                value={pwForm.newPassword}
                onChange={(e) =>
                  setPwForm({ ...pwForm, newPassword: e.target.value })
                }
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">确认新密码</Label>
              <Input
                id="pw-confirm"
                type="password"
                placeholder="再次输入新密码"
                value={pwForm.confirmPassword}
                onChange={(e) =>
                  setPwForm({ ...pwForm, confirmPassword: e.target.value })
                }
                className="rounded-xl"
              />
            </div>
          </div>
          <Button
            className="mt-4 rounded-xl gradient-primary text-white border-0 w-full sm:w-auto"
            onClick={handleChangePassword}
            disabled={pwLoading}
          >
            {pwLoading ? "修改中..." : "修改密码"}
          </Button>
        </CardContent>
      </Card>

      {/* 工时设置卡片 */}
      <Card className="shadow-soft rounded-2xl mb-6">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">工时设置</h2>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-capacity">每周标准工时（小时）</Label>
            <div className="flex items-center gap-3">
              <Input
                id="s-capacity"
                type="number"
                min={1}
                max={80}
                value={capacityValue}
                onChange={(e) => setCapacityValue(Number(e.target.value))}
                className="rounded-xl max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                用于计算工作饱和度（默认 40h）
              </p>
            </div>
          </div>
          <Button
            className="mt-4 rounded-xl gradient-primary text-white border-0 w-full sm:w-auto"
            onClick={handleSaveCapacity}
            disabled={capacityLoading}
          >
            {capacityLoading ? "保存中..." : "保存工时设置"}
          </Button>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Button
        variant="outline"
        className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive gap-2"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="w-4 h-4" />
        退出登录
      </Button>
    </div>
  );
}
