"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Users,
  BarChart3,
  FileText,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "进度看板",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "overview",
  },
  {
    label: "项目管理",
    href: "/projects",
    icon: FolderKanban,
    section: "overview",
  },
  {
    label: "工作记录",
    href: "/worklog",
    icon: ClipboardList,
    section: "workspace",
  },
  {
    label: "人员看板",
    href: "/admin/workload",
    icon: BarChart3,
    section: "admin",
    adminOnly: true,
  },
  {
    label: "周报汇总",
    href: "/admin/weekly",
    icon: FileText,
    section: "admin",
    adminOnly: true,
  },
  {
    label: "用户管理",
    href: "/admin/users",
    icon: Users,
    section: "admin",
    adminOnly: true,
  },
];

const sectionLabels: Record<string, string> = {
  overview: "OVERVIEW",
  workspace: "WORKSPACE",
  admin: "ADMIN",
};

// 手机底部导航的紧凑标签（覆盖默认 label）
const MOBILE_SHORT_LABEL: Record<string, string> = {
  "/dashboard": "看板",
  "/projects": "项目",
  "/worklog": "记录",
  "/admin/workload": "人员",
  "/admin/weekly": "周报",
  "/admin/users": "用户",
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [meOpen, setMeOpen] = useState(false);
  const isAdmin = session?.user?.role === "ADMIN";

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // 按 section 分组（桌面侧栏用）
  const sections = filteredItems.reduce<Record<string, NavItem[]>>(
    (acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    },
    {}
  );

  // 手机底部导航：根据角色展示全部可用入口 + 「我」
  const mobileNavItems = filteredItems;
  const mobileSlotCount = mobileNavItems.length + 1;

  const isHrefActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const desktopContent = (
    <>
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-lg shadow-primary">
          筑
        </div>
        <div>
          <div className="text-xl font-bold text-gradient-primary">筑管</div>
          <div className="text-[11px] text-muted-foreground">
            Project Manager
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-muted-foreground px-3.5 pt-6 pb-2.5">
              {sectionLabels[section]}
            </div>
            {items.map((item) => {
              const isActive = isHrefActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-1",
                    isActive
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-1"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {session?.user && (
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-primary/5 to-chart-4/5 p-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white text-[15px] font-semibold shadow-primary/30 shadow-md">
              {session.user.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {session.user.name}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {session.user.role === "ADMIN" ? "管理员" : "成员"}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* 桌面侧边栏 */}
      <aside className="hidden md:flex w-[260px] flex-col fixed h-screen bg-card border-r border-border p-5 pt-8 z-10">
        {desktopContent}
      </aside>

      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border">
        <div
          className="grid pt-1.5"
          style={{
            gridTemplateColumns: `repeat(${mobileSlotCount}, minmax(0, 1fr))`,
            paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)",
          }}
        >
          {mobileNavItems.map((item) => {
            const isActive = isHrefActive(item.href);
            const label = MOBILE_SHORT_LABEL[item.href] ?? item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors leading-none",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <item.icon
                  className={cn("w-5 h-5", isActive && "text-primary")}
                />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMeOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors leading-none",
              meOpen
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <UserIcon className="w-5 h-5" />
            <span className="whitespace-nowrap">我</span>
          </button>
        </div>
      </nav>

      {/* 移动端「我」面板 */}
      <Sheet open={meOpen} onOpenChange={setMeOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6 md:hidden">
          <SheetHeader>
            <SheetTitle>我的</SheetTitle>
          </SheetHeader>
          {session?.user && (
            <div className="px-4 pb-2">
              <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/5 to-chart-4/5 p-3.5">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white text-[15px] font-semibold shadow-primary/30 shadow-md">
                  {session.user.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {session.user.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {session.user.role === "ADMIN" ? "管理员" : "成员"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-4 pt-2">
            <button
              onClick={() => {
                setMeOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
