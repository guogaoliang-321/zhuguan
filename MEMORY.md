# 筑管 ZhuGuan - 开发记忆 & 待办规划

> 本文件记录项目的长期规划、权限模型、未完成的任务清单。每次开工前先读这里，做完一个阶段就更新「进度日志」。

---

## 🎯 当前功能全景（2026-04-19 · 8 阶段全部上线）

### 页面入口
| 路由 | 说明 | 谁能访问 |
|------|------|---------|
| `/dashboard` | 进度看板 · 本周工时提醒、项目动态轮播、状态卡可点击筛选 | 全员（按权限过滤） |
| `/projects` | 项目列表 | 全员（MEMBER 仅看参与的） |
| `/projects/[id]` | 项目详情 · 节点 / 成员 / 备注 / **工时贡献** / 基本信息 | 参与项目者 |
| `/worklog` | 工作记录列表 | 全员（看自己的） |
| `/worklog/new` | 写工作记录（hours + category 必填） | 全员 |
| `/my/workload` | **我的工作量** · 月度工时、饱和度环、项目/类别分布、按周柱状图 | 全员 |
| `/activities` | 全部项目动态（按类型筛选） | 全员（按权限过滤） |
| `/admin/workload` | 人员工作看板 · 时间范围切换、团队对比、本周未填徽章 | ADMIN |
| `/admin/weekly` | 周报汇总 | ADMIN |
| `/admin/users` | 用户管理 | ADMIN |

### API 端点
| 端点 | 说明 |
|------|------|
| `GET /api/dashboard` | 项目 + stats + 当前用户本周工时（`me`） |
| `GET /api/activities?limit=` | 全部动态（备注/工作记录/里程碑混合） |
| `GET /api/projects` | 项目列表（按 `projectVisibilityFilter` 过滤） |
| `POST /api/projects` | 新建（仅 ADMIN/PROJECT_LEAD） |
| `GET/PUT/DELETE /api/projects/[id]` | 详情 / 编辑（isLead） / 删除（仅 ADMIN） |
| `POST /api/projects/[id]/milestones` | 新建节点（isLead 或 ADMIN） |
| `PUT /api/projects/[id]/milestones/[mid]` | 编辑或勾选完成（完成可由 assignee 操作） |
| `POST /api/projects/[id]/members` | 添加成员（isLead 或 ADMIN） |
| `POST /api/projects/[id]/notes` | 发布备注（isMember 或 ADMIN） |
| `GET /api/projects/[id]/workload` | 项目成员工时贡献聚合 |
| `GET/POST /api/worklogs` | 列表（按 `workLogVisibilityFilter`）/ 新建 |
| `DELETE /api/worklogs/[id]` | 删除（仅本人或 ADMIN） |
| `GET /api/worklogs/mine?month=YYYY-MM` | 我的工作量聚合（含饱和度） |
| `GET /api/worklogs/people-board?range=` | 人员看板 · 支持 `this-week/this-month/this-quarter/last-30` 预设或 `?from&to` |
| `GET /api/worklogs/weekly` | 周报汇总（仅 ADMIN） |
| `GET /api/worklogs/workload` | 工作负荷速览（仅 ADMIN） |

### 核心数据字段
- `User.weeklyCapacity Decimal @default(40)` · 每周标准工时，用于饱和度计算
- `WorkLog.hours Decimal`（必填，0.5–24h）
- `WorkLog.category String`（必填，30 种预设类别分 6 组）

### 权限统一出口
- `src/lib/permissions.ts` · 30+ 纯函数 + 两个 Prisma where 过滤器
- API 严禁散写 `role !== "ADMIN"`；全部走 permissions 模块
- UI 用 `useSession` 拿 session.user，调用 `canXxx()` 决定按钮显隐

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
| 2 | **「我的工作量」MVP** | 新页面 `/my/workload` + API `/api/worklogs/mine?month=`；本月工时、项目饼图、类别分布、按周折线 | 阶段 1 | 0.5 天 | 🔴 核心痛点 | ✅ 已完成 |
| 3 | **Schema 三改 + 数据回填** | migration：`WorkLog.hours` 去 `?`、`category` 去 `?`（NULL → "其他"）、新增 `User.weeklyCapacity Decimal @default(40)` | 阶段 2 | 0.25 天 | 🟡 | ✅ 已完成 |
| 4 | **管理员看板加时间范围** | `people-board` API 加 `?from=&to=` 参数；UI 加「本月/上月/本季/自定义」筛选；工时趋势图 | 阶段 1+3 | 0.75 天 | 🟡 | ✅ 已完成 |
| 5 | **我的工作量升级** | 饱和度环（基于 `weeklyCapacity`）+ 历史月份切换 + 按项目展开 | 阶段 3 | 0.25 天 | 🟢 | ✅ 已完成 |
| 6 | **团队横向对比视图** | 管理员视图：全员本月工时柱状图 / 饱和度散点 | 阶段 3+4 | 0.5 天 | 🟢 可选 | ✅ 已完成 |
| 7 | **项目 × 人员矩阵** | 项目详情页新增「成员工时贡献」标签 | 阶段 4 | 0.5 天 | 🟢 可选 | ✅ 已完成 |
| 8 | **工作记录补录提醒** | 定时任务识别「本周未填」「连续低报」；「我的」显示红点 | 阶段 3 | 0.75 天 | 🟢 可选 | ✅ 已完成（简化版） |

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
- ✅ **阶段 2 完成**：
  - 新增 `src/app/api/worklogs/mine/route.ts`（按月聚合：工时总计、按项目/类别/周分布、本周补录提醒）
  - 新增页面 `src/app/(main)/my/workload/page.tsx`（月份切换、3 个统计卡、按周柱状图、按项目/类别横条、最近 20 条记录）
  - 侧栏 workspace 区 + 手机「我的」Sheet「个人」组 均新增入口
- ✅ **阶段 3 完成**：
  - migration `20260418160135_require_hours_category_add_capacity` 已应用到本地库
  - `User.weeklyCapacity Decimal @default(40)` 新增
  - `WorkLog.hours` / `category` 改为必填，历史 NULL 回填 0 / "其他"
  - API Zod: `category` 改为 `.min(1)`；表单加 `*` 标记 + 禁用未选择类别时提交
  - Zeabur 部署会自动执行 `prisma migrate deploy`

### 2026-04-19
- ✅ **阶段 5 完成**：API 返回 `weeklyCapacity/saturation/workDaysInMonth`；页面加 `SaturationRing` 环形进度
- ✅ **阶段 4 完成**：`people-board` API 支持 `?range=this-week|this-month|this-quarter|last-30` 或自定义 `?from&to`；响应包 `{from, to, items}`，每人含 `rangeHours/rangeSaturation/byCategory`；UI 顶部加预设切换
- ✅ **阶段 6 完成**：`TeamComparison` 组件，按时间范围排序展示工时条 + 饱和度标签
- ✅ **阶段 7 完成**：新 API `/api/projects/[id]/workload` + 项目详情「工时贡献」Tab（顶部 KPI + 成员排行条 + 类别徽章）
- ✅ **阶段 8 完成**（简化版）：放弃 cron，改用实时查询
  - Dashboard API 返回 `me: {thisWeekHours, thisWeekFilled}`
  - Dashboard 本周未填时显示黄色补录卡片；已填时显示灰色统计行
  - admin/workload 每个人卡片头显示「本周未填」警告徽章

🎉 **8 阶段路线图全部完成**

---

## 五、相关文档

- `CLAUDE.md` — 部署配置、本地开发命令、默认账号
- `prisma/schema.prisma` — 当前数据模型
- `src/lib/api-utils.ts` — `getSession()` / `unauthorized()` 封装
