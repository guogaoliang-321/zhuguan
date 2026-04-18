# 筑管 ZhuGuan - 开发记忆 & 待办规划

> 本文件记录项目的长期规划、权限模型、未完成的任务清单。每次开工前先读这里，做完一个阶段就更新「进度日志」。

---

## 一、权限模型（三角色 RBAC）

**全局角色枚举（已存在于 schema）**
- `ADMIN` — 管理员，可以看/改一切
- `PROJECT_LEAD` — 项目负责人，可以看所有项目，但只能改自己负责的项目
- `MEMBER` — 普通员工，只能看自己参与的项目，只能操作自己的数据

**项目级关系（派生，非枚举）**
- `isLead(p)` = `p.leadId === user.id`
- `isMember(p)` = 用户在 `p.members` 里 或 `isLead(p)`

### 权限矩阵

#### 项目 Project
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 查看项目列表 | 全部 | 全部 | 仅 `isMember` 的 |
| 查看项目详情 | 全部 | 全部 | 仅参与的 |
| 新建项目 | ✅ | ✅ | ❌ |
| 编辑项目信息 | ✅ | 仅 `isLead` | ❌ |
| 删除 / 归档项目 | ✅ | ❌ | ❌ |
| 修改阶段 / 状态 | ✅ | 仅 `isLead` | ❌ |

#### 项目成员 ProjectMember
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 查看成员名单 | 全部 | 全部 | 仅参与项目的 |
| 增删成员 | ✅ | 仅 `isLead` | ❌ |

#### 里程碑 Milestone
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 查看 | 同项目详情 | 同项目详情 | 同项目详情 |
| 新建 / 编辑 / 删除 | ✅ | 仅 `isLead` | ❌ |
| 勾选完成 | ✅ | 仅 `isLead` | 仅 `assigneeId === self` |

#### 项目备注 ProjectNote
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 查看 | 同项目详情 | 同项目详情 | 同项目详情 |
| 发布 | ✅ | 仅 `isMember` | 仅 `isMember` |
| 编辑 / 删除自己的 | ✅ | ✅ | ✅ |
| 删除他人的 | ✅ | 仅 `isLead(p)` | ❌ |

#### 工作记录 WorkLog（最关键）
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 查看自己的 | ✅ | ✅ | ✅ |
| 查看他人的 | 全部 | 仅 `isLead(p)` 项目下的 | ❌ |
| 新建 / 编辑 / 删除自己的 | ✅ | ✅（需 `isMember`）| ✅（需 `isMember`）|
| 代他人填 / 改他人的 | ✅ | ❌ | ❌ |

#### 周报 Weekly
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 写自己的周报 | ✅ | ✅ | ✅ |
| 查看汇总 | 全部 | 仅 `isLead(p)` 项目成员的 | ❌ |

#### 工作量看板 People Board
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 我的工作量 | ✅ | ✅ | ✅ |
| 查看全员工作量 | ✅ | ❌ | ❌ |
| 查看下属工作量 | ✅ | 仅 `isLead(p)` 项目成员 | ❌ |

#### 用户管理
| 操作 | ADMIN | PROJECT_LEAD | MEMBER |
|---|---|---|---|
| 查看用户列表 | ✅ | ❌ | ❌ |
| 创建 / 编辑 / 删除用户 | ✅ | ❌ | ❌ |
| 编辑自己的资料 / 改密码 | ✅ | ✅ | ✅ |

---

## 二、执行步骤表

| # | 阶段 | 交付物 | 依赖 | 估时 | 优先级 | 状态 |
|---|---|---|---|---|---|---|
| 1 | **权限基础设施** | `lib/permissions.ts` + 所有 API route 接入 + UI 按角色隐藏按钮 | — | 1 天 | 🔴 必须 | ✅ 已完成 |
| 2 | **「我的工作量」MVP** | 新页面 `/my/workload` + API `/api/worklogs/mine?month=`；本月工时、项目饼图、类别分布、按周折线 | 阶段 1 | 0.5 天 | 🔴 核心痛点 | ⏸ 待启动 |
| 3 | **Schema 三改 + 数据回填** | migration：`WorkLog.hours` 去 `?`、`category` 去 `?`（NULL → "其他"）、新增 `User.weeklyCapacity Decimal @default(40)` | 阶段 2 | 0.25 天 | 🟡 | ⏸ 待启动 |
| 4 | **管理员看板加时间范围** | `people-board` API 加 `?from=&to=` 参数；UI 加「本月/上月/本季/自定义」筛选；工时趋势图 | 阶段 1+3 | 0.75 天 | 🟡 | ⏸ 待启动 |
| 5 | **我的工作量升级** | 饱和度环（基于 `weeklyCapacity`）+ 历史月份切换 + 按项目展开 | 阶段 3 | 0.25 天 | 🟢 | ⏸ 待启动 |
| 6 | **团队横向对比视图** | 管理员视图：全员本月工时柱状图 / 饱和度散点 | 阶段 3+4 | 0.5 天 | 🟢 可选 | ⏸ 待启动 |
| 7 | **项目 × 人员矩阵** | 项目详情页新增「成员工时贡献」标签 | 阶段 4 | 0.5 天 | 🟢 可选 | ⏸ 待启动 |
| 8 | **工作记录补录提醒** | 定时任务识别「本周未填」「连续低报」；「我的」显示红点 | 阶段 3 | 0.75 天 | 🟢 可选 | ⏸ 待启动 |

**合计**：核心（1–4）≈ 2.5 天；全部 ≈ 4.5 天

---

## 三、阶段 1 详细拆解

### 1.1 `lib/permissions.ts` 需要的函数

**全局角色判定**
- `isAdmin(user)` / `isProjectLead(user)` / `isMember(user)`

**项目级关系**
- `isLeadOf(user, project)` — 传入 `{ leadId }` 即可判断
- `isMemberOf(user, project)` — 传入 `{ leadId, members: [{userId}] }`

**项目 CRUD**
- `canViewProject(user, project)`
- `canCreateProject(user)`
- `canEditProject(user, project)`
- `canDeleteProject(user)`
- `projectVisibilityFilter(user)` — 返回 Prisma where 条件，用于列表查询

**里程碑**
- `canManageMilestones(user, project)` — 新建/编辑/删除
- `canCompleteMilestone(user, milestone, project)` — 勾选完成（assignee 也可）

**成员**
- `canManageMembers(user, project)`

**备注**
- `canAddNote(user, project)`
- `canEditNote(user, note)` / `canDeleteNote(user, note, project)`

**工作记录**
- `canViewWorkLog(user, log, project?)` — project 可选，用于项目负责人判断
- `canEditWorkLog(user, log)` — 只能改自己的（ADMIN 除外）
- `canCreateWorkLogFor(user, targetUserId, project)` — ADMIN 可代填，否则只能给自己填
- `workLogVisibilityFilter(user)` — Prisma where 条件

**工作量**
- `canViewAllWorkload(user)` — ADMIN only
- `canViewUserWorkload(user, targetUserId, sharedProjects[])` — PROJECT_LEAD 需共享项目

**用户管理**
- `canManageUsers(user)` — ADMIN only

### 1.2 已接入权限的 API Route 清单

- [x] `GET /api/projects` — `projectVisibilityFilter`
- [x] `POST /api/projects` — `canCreateProject`
- [x] `GET /api/projects/[id]` — `canViewProject`
- [x] `PUT /api/projects/[id]` — `canEditProject`
- [x] `DELETE /api/projects/[id]` — `canDeleteProject`
- [x] `POST /api/projects/[id]/milestones` — `canManageMilestones`
- [x] `PUT /api/projects/[id]/milestones/[milestoneId]` — `canManageMilestones` 或 `canCompleteMilestone`（仅勾选完成时）
- [x] `DELETE /api/projects/[id]/milestones/[milestoneId]` — `canManageMilestones`
- [x] `POST /api/projects/[id]/members` — `canManageMembers`
- [x] `DELETE /api/projects/[id]/members/[memberId]` — `canManageMembers`
- [x] `POST /api/projects/[id]/notes` — `canAddNote`
- [x] `GET /api/worklogs` — `workLogVisibilityFilter`
- [x] `POST /api/worklogs` — `canCreateWorkLogFor`（支持 ADMIN 代填）
- [x] `DELETE /api/worklogs/[id]` — `canEditWorkLog`
- [x] `GET /api/worklogs/people-board` — 暂仅 ADMIN（阶段 4 扩展 PROJECT_LEAD）
- [x] `GET /api/worklogs/weekly` — 同上
- [x] `GET /api/worklogs/workload` — 同上
- [x] `GET /api/dashboard` — 项目/动态均按 `projectVisibilityFilter` 过滤
- [x] `GET /api/activities` — 按 `projectVisibilityFilter` 过滤
- [ ] `GET /api/users` — **暂保持全部认证用户可见**（用于选择成员/负责人），未来可区分敏感字段

### 1.3 UI 权限 Guard 进度

- [x] `projects/page.tsx` — 「新建项目」按钮仅 ADMIN/PROJECT_LEAD 可见
- [x] `projects/[id]/page.tsx` — `canEdit` 改用 `canEditProject`（原本就正确，统一出口）
- [x] Sidebar — 人员看板/周报/用户 已通过 `adminOnly` 限定 ADMIN
- [ ] `dashboard/page.tsx` — stats 数字来自已过滤的 API，无需改 UI；⚠️ 手动验证 MEMBER 登录后只看到自己项目
- [ ] `projects/[id]/page.tsx` 内部的删除/添加节点/管理成员按钮 — 已通过 `canEdit` 间接生效，但建议用更细粒度的 `canManageMilestones` / `canManageMembers` 复查
- [ ] PROJECT_LEAD 在人员看板的下属视图 — 阶段 4

---

## 四、进度日志

### 2026-04-18
- ✅ 起草本 MEMORY.md + 权限规则表 + 8 阶段执行表
- ✅ **阶段 1 完成**：
  - 新增 `src/lib/permissions.ts`（ADMIN / PROJECT_LEAD / MEMBER 三角色的完整判定函数）
  - 15 个 API route 接入权限模块，散落的 `role !== "ADMIN"` 全部清理
  - 「新建项目」按钮按角色隐藏；项目详情 `canEdit` 统一出口
  - **遗留**：PROJECT_LEAD 在人员看板的下属视图要到阶段 4 才补；手动验证 MEMBER 角色的行为待做
- ⏭️ 下一步：阶段 2「我的工作量」MVP

---

## 五、相关文档

- `CLAUDE.md` — 部署配置、本地开发命令、默认账号
- `prisma/schema.prisma` — 当前数据模型
- `src/lib/api-utils.ts` — `getSession()` / `unauthorized()` 封装
