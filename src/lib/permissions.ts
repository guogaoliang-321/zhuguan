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
  projectId: string;
}

/** 备注上下文 */
export interface NoteCtx {
  authorId: string;
}

/** 里程碑上下文 */
export interface MilestoneCtx {
  assigneeId: string | null;
}

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
        { project: { leadId: u.id } },
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
