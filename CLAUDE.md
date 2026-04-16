# 筑管 ZhuGuan - 项目上下文

## 线上部署

| 项目 | 值 |
|------|-----|
| 线上地址 | https://xbyyls.zeabur.app |
| 部署平台 | Zeabur (Tencent Hong Kong) |
| 数据库 | Zeabur 内置 PostgreSQL (119.28.26.235:32537) |
| GitHub 仓库 | guogaoliang-321/zhuguan |
| SSH 别名 | `github-321`（~/.ssh/config 已配置） |

## 环境变量（Zeabur）

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Zeabur 自动注入，无需手动设置 |
| `NEXTAUTH_SECRET` | JWT 签名密钥 |
| `NEXTAUTH_URL` | `https://xbyyls.zeabur.app` |
| `AUTH_TRUST_HOST` | `true`（生产环境必须） |

## 本地开发

```bash
# 启动 PostgreSQL
brew services start postgresql@14

# 启动开发服务器
PORT=3002 npm run dev
# http://localhost:3002（3000 被其他应用占用）

# 数据库操作
npm run db:seed      # 写入示例数据
npm run db:studio    # Prisma Studio
npm run db:migrate   # 运行迁移
```

## 默认账号

- 管理员：`guogaoliang` / `admin123`
- 普通成员：`zhangmingyuan` / `member123`（其他成员密码相同）

## 技术要点

- **Prisma 7** 使用 adapter 模式（`@prisma/adapter-pg`），URL 在 `prisma.config.ts` 配置
- **NextAuth v5** 拆分为 `auth.config.ts`（轻量，供 middleware）+ `auth.ts`（完整，含 Prisma）
- **Seed API**：`POST /api/seed?secret=NEXTAUTH_SECRET` 用于线上初始化数据
- **middleware.ts** 有 Next.js 16 deprecation 警告（推荐 proxy.ts），功能不受影响

## 工作类别（30 种）

设计类：方案设计/方案文本/方案汇报/方案深化/初设图纸/施工图出图/模型制作/效果图/计算书
配合类：配合变更/配合报审/配合投标/图纸校审/资料整理
协调类：甲方对接/政府对接/内部协调/专业配合/会议
外出类：现场踏勘/出差考察/驻场服务
评审类：方案评审/初设评审/施工图审查/竣工验收
其他类：学习培训/其他

## Git 推送

```bash
# 推送到 guogaoliang-321 账号（SSH 别名 github-321）
git remote set-url origin git@github-321:guogaoliang-321/zhuguan.git
git push
```
