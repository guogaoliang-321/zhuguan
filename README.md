# 筑管 ZhuGuan

建筑设计院内部项目管理系统

**线上地址**：https://xbyyls.zeabur.app

## 功能

- **进度看板** — 全所项目红黄绿灯状态一览，卡片/表格视图切换，最新项目动态
- **项目管理** — 项目台账 CRUD，设计节点、项目成员、项目备注
- **工作记录** — 员工按日记录工时和工作内容，30 种细化工作类别
- **人员工作看板** — 甘特时间线色块，跨项目追踪每人工作，节点可视化
- **周报汇总** — 管理员按员工查看本周工作汇总
- **权限管理** — ADMIN / MEMBER 角色区分，非管理员不可见管理功能

## 技术栈

- Next.js 16 (App Router, Turbopack)
- PostgreSQL (Prisma 7 ORM, adapter 模式)
- NextAuth.js v5 (Credentials + JWT)
- shadcn/ui + Tailwind CSS 4
- TypeScript, Zod, date-fns

## 部署方式

### 线上部署（Zeabur）

项目已部署在 Zeabur (Tencent Hong Kong)。

**环境变量**（在 Zeabur 控制台设置）：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Zeabur PostgreSQL 自动注入 |
| `NEXTAUTH_SECRET` | JWT 签名密钥（`openssl rand -base64 32` 生成） |
| `NEXTAUTH_URL` | 部署域名，如 `https://xbyyls.zeabur.app` |
| `AUTH_TRUST_HOST` | `true`（生产环境必须设置） |

**初始化数据**：

```bash
curl -X POST "https://你的域名/api/seed?secret=你的NEXTAUTH_SECRET"
```

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL 和 NEXTAUTH_SECRET

# 3. 启动 PostgreSQL（Homebrew）
brew services start postgresql@14
createdb zhuguan

# 4. 初始化数据库
npx prisma generate
npx prisma migrate dev
npm run db:seed

# 5. 启动
npm run dev
```

### Docker Compose（仅数据库）

```bash
docker compose up -d
# DATABASE_URL="postgresql://zhuguan:zhuguan_dev@localhost:5432/zhuguan?schema=public"
```

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | guogaoliang | admin123 |
| 普通成员 | zhangmingyuan | member123 |
| 普通成员 | lijianguo | member123 |

其他成员（wangxiaofeng / zhaopengfei / chensiyuan / liuwei）密码均为 `member123`。

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建（含 prisma generate + migrate deploy）
npm run db:seed      # 写入示例数据
npm run db:studio    # 打开 Prisma Studio 查看数据
npm run db:migrate   # 运行数据库迁移
```

## 项目结构

```
src/
├── app/
│   ├── (auth)/login/           # 登录页
│   ├── (main)/                 # 需登录的页面
│   │   ├── dashboard/          # 进度看板
│   │   ├── projects/           # 项目管理（列表/新建/详情/编辑）
│   │   ├── worklog/            # 工作记录（列表/新增）
│   │   └── admin/              # 管理员功能
│   │       ├── users/          # 用户管理
│   │       ├── workload/       # 人员工作看板（甘特时间线）
│   │       └── weekly/         # 周报汇总
│   └── api/                    # API 路由
│       ├── dashboard/          # 看板数据 + 最新动态
│       ├── projects/[id]/      # 项目 CRUD + 成员/里程碑/备注
│       ├── users/              # 用户列表
│       ├── worklogs/           # 工作记录 + 工作负荷 + 周报 + 人员看板
│       └── seed/               # 线上数据初始化
├── components/
│   ├── layout/                 # 布局（侧边栏）
│   ├── projects/               # 项目表单
│   └── ui/                     # shadcn/ui 组件（21个）
└── lib/
    ├── prisma.ts               # Prisma Client（adapter 模式）
    ├── auth.ts                 # NextAuth 完整配置
    ├── auth.config.ts          # NextAuth 轻量配置（供 middleware）
    ├── api-utils.ts            # API 辅助函数
    └── constants.ts            # 阶段/状态/工作类别常量
```

## 设计风格

采用「空间光影」设计方案：

- 暖白背景 `#faf9f7`
- 紫色主色 `#6c5ce7` 渐变色系
- 大圆角 (16-20px)
- 弹性悬浮动画
- 柔和阴影
- 手机端自适应
