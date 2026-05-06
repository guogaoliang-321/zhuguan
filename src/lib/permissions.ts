/**
 * 筑管权限判定模块
 *
 * 所有权限判断的唯一出口，API route 与 UI 组件都应调用这里的函数，
 * 严禁在业务代码里散写 `user.role === "ADMIN"` 之类的判断。
 *
 * 权限规则详见：MEMORY.md 「权限模型」章节
 */
import type { UserRole } from "@/lib/auth.config";
import type { Prisma } from "@/generated/prisma/client";

// ========== 类型 ==========

/** 最小会话用户：只要求 id + role，API 和 UI 都能用 */
export interface SessionUser {
  id: string;
  role: UserRole;
}

/** 项目上下文：做 isLead/isMember 判断时传入 */
export interface ProjectCtx {
  leadId: string;
  members?: ReadonlyArray<{ userId: string }>;
}

/** 工作记录上下文：做 canEditWorkLog 判断时传入 */
export interface WorkLogCtx {
  userId: string;
  projectId: string | null;
}

/** 备注上下文 */
export interface NoteCtx {
  authorId: string;
}

/** 里程碑上下文 */
export interface MilestoneCtx {
  assigneeId: string | null;
}

/** 任务上下文：做 canEditTask / canConfirmTask 判断时传入 */
export interface TaskCtx {
  assigneeId: string;
  createdById?: string;
  projectId: string | null;
}

/** 合法的任务状态值 */
export type TaskStatus = "pending" | "in_progress" | "done" | "overdue";

/** 合法的任务优先级 */
export type TaskPriority = "normal" | "urgent";

// ========== 基础角色判定 ==========

export function isAdmin(u: SessionUser): boolean {
  return u.role === "ADMIN";
}

export function isProjectLead(u: SessionUser): boolean {
  return u.role === "PROJECT_LEAD";
}

export function isMemberRole(u: SessionUser): boolean {
  return u.role === "MEMBER";
}

// ========== 项目级关系 ==========

export function isLeadOf(u: SessionUser, p: ProjectCtx): boolean {
  return p.leadId === u.id;
}

export function isMemberOf(u: SessionUser, p: ProjectCtx): boolean {
  if (isLeadOf(u, p)) return true;
  return Boolean(p.members?.some((m) => m.userId === u.id));
}

// ========== 项目 CRUD ==========

export function canViewProject(u: SessionUser, p: ProjectCtx): boolean {
  if (isAdmin(u) || isProjectLead(u)) return true;
  return isMemberOf(u, p);
}

export function canCreateProject(u: SessionUser): boolean {
  return isAdmin(u) || isProjectLead(u);
}

export function canEditProject(u: SessionUser, p: ProjectCtx): boolean {
  if (isAdmin(u)) return true;
  return isLeadOf(u, p);
}

export function canDeleteProject(u: SessionUser): boolean {
  return isAdmin(u);
}

/**
 * 项目列表查询的可见性过滤器
 * - ADMIN / PROJECT_LEAD: 看全部（返回空对象，不过滤）
 * - MEMBER: 只看自己是 lead 或 member 的
 */
export function projectVisibilityFilter(
  u: SessionUser
): Prisma.ProjectWhereInput {
  if (isAdmin(u) || isProjectLead(u)) return {};
  return {
    OR: [
      { leadId: u.id },
      { members: { some: { userId: u.id } } },
    ],
  };
}

// ========== 里程碑 ==========

export function canManageMilestones(u: SessionUser, p: ProjectCtx): boolean {
  if (isAdmin(u)) return true;
  return isLeadOf(u, p);
}

export function canCompleteMilestone(
  u: SessionUser,
  m: MilestoneCtx,
  p: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (isLeadOf(u, p)) return true;
  return m.assigneeId === u.id;
}

// ========== 项目成员 ==========

export function canManageMembers(u: SessionUser, p: ProjectCtx): boolean {
  if (isAdmin(u)) return true;
  return isLeadOf(u, p);
}

// ========== 项目备注 ==========

export function canAddNote(u: SessionUser, p: ProjectCtx): boolean {
  if (isAdmin(u)) return true;
  return isMemberOf(u, p);
}

export function canEditNote(u: SessionUser, n: NoteCtx): boolean {
  if (isAdmin(u)) return true;
  return n.authorId === u.id;
}

export function canDeleteNote(
  u: SessionUser,
  n: NoteCtx,
  p: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (n.authorId === u.id) return true;
  return isLeadOf(u, p);
}

// ========== 工作记录 ==========

/**
 * 是否可以查看某条工作记录
 * project 参数可选：传入时 PROJECT_LEAD 可以看到自己负责项目下的所有记录
 */
export function canViewWorkLog(
  u: SessionUser,
  log: WorkLogCtx,
  project?: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (log.userId === u.id) return true;
  if (isProjectLead(u) && project && isLeadOf(u, project)) return true;
  return false;
}

/** 是否可以编辑/删除某条工作记录（只能改自己的，ADMIN 例外） */
export function canEditWorkLog(u: SessionUser, log: WorkLogCtx): boolean {
  if (isAdmin(u)) return true;
  return log.userId === u.id;
}

/**
 * 是否可以为 targetUserId 新建一条工作记录
 * - 给自己新建：必须是项目的 isMember
 * - 给别人新建：只有 ADMIN
 */
export function canCreateWorkLogFor(
  u: SessionUser,
  targetUserId: string,
  p: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (targetUserId !== u.id) return false;
  return isMemberOf(u, p);
}

/**
 * 工作记录列表查询的可见性过滤器
 * - ADMIN: 看全部
 * - PROJECT_LEAD: 看自己的 + 自己负责项目下所有人的
 * - MEMBER: 只看自己的
 */
export function workLogVisibilityFilter(
  u: SessionUser
): Prisma.WorkLogWhereInput {
  if (isAdmin(u)) return {};
  if (isProjectLead(u)) {
    return {
      OR: [
        { userId: u.id },
        { projectId: { not: null }, project: { leadId: u.id } },
      ],
    };
  }
  return { userId: u.id };
}

// ========== 工作量看板 ==========

export function canViewAllWorkload(u: SessionUser): boolean {
  return isAdmin(u);
}

/**
 * 是否可以查看指定用户的工作量
 * - ADMIN: 任何人
 * - PROJECT_LEAD: 自己负责项目的成员（调用方需先查出共享项目列表）
 * - 本人：看自己
 */
export function canViewUserWorkload(
  u: SessionUser,
  targetUserId: string,
  opts: { hasSharedLedProject?: boolean } = {}
): boolean {
  if (isAdmin(u)) return true;
  if (targetUserId === u.id) return true;
  if (isProjectLead(u) && opts.hasSharedLedProject) return true;
  return false;
}

// ========== 周报 ==========

export function canViewAllWeekly(u: SessionUser): boolean {
  return isAdmin(u);
}

export function canViewUserWeekly(
  u: SessionUser,
  targetUserId: string,
  opts: { hasSharedLedProject?: boolean } = {}
): boolean {
  return canViewUserWorkload(u, targetUserId, opts);
}

// ========== 用户管理 ==========

export function canManageUsers(u: SessionUser): boolean {
  return isAdmin(u);
}

// ========== 非项目类别 ==========

/** 任何已登录用户都可以创建和查看非项目类别 */
export function canManageNonProjectCategories(_u: SessionUser): boolean {
  return true;
}

// ========== 任务（Phase 1） ==========

/**
 * 是否可以查看某个任务
 * - ADMIN：全部
 * - 任务责任人：自己被派的任务
 * - PROJECT_LEAD：自己负责项目下的任务（需传 project）
 * - 项目成员：所在项目下的任务（需传 project）— 用于团队透明
 */
export function canViewTask(
  u: SessionUser,
  t: TaskCtx,
  project?: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (t.assigneeId === u.id) return true;
  if (!project) return false;
  if (isProjectLead(u) && isLeadOf(u, project)) return true;
  return isMemberOf(u, project);
}

/**
 * 是否可以在指定项目下创建新任务
 * - ADMIN：任何项目
 * - 项目负责人：自己负责的项目
 * 非项目任务（projectId = null）目前只允许 ADMIN 创建
 */
export function canCreateTask(u: SessionUser, p?: ProjectCtx): boolean {
  if (isAdmin(u)) return true;
  if (!p) return false;
  return isLeadOf(u, p);
}

/**
 * 是否可以编辑任务（修改名称 / 工时 / 时间 / 优先级 / 责任人等）
 * - ADMIN：全部
 * - 项目负责人：自己负责的项目下的任务
 */
export function canEditTask(
  u: SessionUser,
  t: TaskCtx,
  project?: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (!project) return t.createdById === u.id;
  return isLeadOf(u, project);
}

/**
 * 是否可以删除任务
 * - ADMIN：全部
 * - 项目负责人：自己负责的项目下的任务
 */
export function canDeleteTask(
  u: SessionUser,
  _t: TaskCtx,
  project?: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (!project) return false;
  return isLeadOf(u, project);
}

/**
 * 员工是否可以勾选"已完成"
 * - ADMIN：全部（管理员代操作）
 * - 任务责任人：自己被派的任务
 */
export function canMarkTaskDone(u: SessionUser, t: TaskCtx): boolean {
  if (isAdmin(u)) return true;
  return t.assigneeId === u.id;
}

/**
 * 员工是否可以"每日确认"（Phase 2 启用）
 * 仅任务责任人本人
 */
export function canConfirmTaskByEmployee(u: SessionUser, t: TaskCtx): boolean {
  return t.assigneeId === u.id;
}

/**
 * PM 是否可以确认任务完成
 * - ADMIN：全部
 * - 项目负责人：自己负责的项目下的任务
 */
export function canPMConfirmTask(
  u: SessionUser,
  _t: TaskCtx,
  project?: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (!project) return false;
  return isLeadOf(u, project);
}

/**
 * 任务列表查询的可见性过滤器
 * - ADMIN：全部
 * - PROJECT_LEAD：自己被派的 + 自己负责项目下的
 * - MEMBER：自己被派的 + 所在项目下的（用于项目详情页"任务"Tab）
 */
export function taskVisibilityFilter(
  u: SessionUser
): Prisma.TaskWhereInput {
  if (isAdmin(u)) return {};
  if (isProjectLead(u)) {
    return {
      OR: [
        { assigneeId: u.id },
        { project: { leadId: u.id } },
      ],
    };
  }
  return {
    OR: [
      { assigneeId: u.id },
      { project: { members: { some: { userId: u.id } } } },
    ],
  };
}

/**
 * 团队负荷热力图访问权限
 * - ADMIN / PROJECT_LEAD 可查看
 */
export function canViewTeamHeatmap(u: SessionUser): boolean {
  return isAdmin(u) || isProjectLead(u);
}

// ========== 申诉（Phase 2） ==========

/** 谁可以处理申诉：仅 ADMIN */
export function canResolveAppeals(u: SessionUser): boolean {
  return isAdmin(u);
}

/** 申诉可见性：本人 + ADMIN */
export function canViewAppeal(
  u: SessionUser,
  appeal: { authorId: string }
): boolean {
  if (isAdmin(u)) return true;
  return appeal.authorId === u.id;
}

/** 任何登录用户都可以提交申诉 */
export function canCreateAppeal(_u: SessionUser): boolean {
  return true;
}

// ========== 工作记录确认 ==========

/**
 * 是否可以确认某条工作记录
 * - ADMIN: 全部
 * - PROJECT_LEAD: 仅自己负责项目下的记录（传入 project 参数时判断）
 */
export function canConfirmWorkLog(
  u: SessionUser,
  project?: ProjectCtx
): boolean {
  if (isAdmin(u)) return true;
  if (isProjectLead(u) && project && isLeadOf(u, project)) return true;
  return false;
}
