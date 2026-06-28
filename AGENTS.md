# AGENTS.md - AI 代理项目指南

## 项目文档索引

| 文档 | 用途 |
|------|------|
| [README.md](./README.md) | 项目说明、快速开始、跨平台构建指南 |
| [AGENTS.md](./AGENTS.md) | 本文件 — 项目指南、规则、注意事项 |
| [PROGRESS.md](./PROGRESS.md) | 项目进度、已完成工作、短中长期目标 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 技术架构、目录结构、数据模型、API 路由 |

## 项目概述

Bilibili 风格视频平台 MVP，一天内通过自然语言描述完成最小可行产品。

## 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui
- **数据库**: SQLite (Prisma ORM)
- **认证**: NextAuth.js v5
- **视频存储**: 阿里云 OSS + 阿里云 VOD

## 项目规则

1. **沟通语言**: 使用简体中文交流
2. **工作目录**: 固定为 H:\bilibili
3. **技术解释**: 用通俗语言解释技术概念（用户不了解代码和程序开发）
4. **部署方案**: Nginx + 公网服务器（不是 Vercel）
5. **数据库**: 使用 SQLite 文件数据库，方便迁移

## 功能清单（已完成）

### 核心功能
- 首页视频卡片网格布局
- 视频播放页（循环/单次/自动连播三种模式）
- 视频切换（上一个/下一个，PlaylistComponent 原生按钮 + 键盘 ←→）
- 上传视频（支持拖拽、粘贴、进度条）
- 用户系统（登录/注册弹窗、个人主页）
- 基础互动（点赞视频/评论、收藏、评论回复）
- 播放/暂停中心弹性动画
- 用户注销功能（自定义确认弹窗，密码确认，递归删除所有数据）

### 动画系统（Framer Motion）
- 首页/搜索结果视频卡片 staggered fade-in 入场
- 点赞/收藏按钮 whileTap 缩放 + 状态切换弹跳
- 评论区新评论滑入、删除评论高度塌陷淡出
- 推荐列表 staggered 滑入
- 头像菜单 AnimatePresence 淡入缩放
- 视频播放页主内容区和侧边栏入场动画
- 个人主页标签下划线 spring 滑动 + 内容左右滑入滑出
- 深色模式切换 0.3s 颜色渐变过渡（JS class 时序控制）
- 登录/注册弹窗淡入缩放动画

### 搜索功能
- 搜索栏支持 200ms 防抖自动搜索，无需按回车
- 清空搜索内容自动回到首页
- 支持搜索视频（标题/简介/UP主）和搜索评论
- 任意字符部分匹配（不要求连续）
- 匹配字符红色加粗高亮显示
- 搜索视频/评论切换按钮

### 移动端适配
- 所有页面使用 sm: 断点（640px）做移动端/桌面端区分
- Header 搜索栏点击展开动画，间距收紧，logo 字号缩小
- 首页网格响应式 2→3→4→5 列
- 视频播放页播放器/标题/按钮/推荐区间距紧凑化
- 评论区卡片内边距、回复框缩进和宽度适配移动端
- 个人中心 Tab 栏紧凑排列、点赞子菜单移动端改为横排、评论卡片竖排
- 搜索页标题和按钮竖排、评论卡片竖排缩略图
- 投稿页间距收紧
- 移动端双击暂停/播放视频
- 移动端头像点击切换菜单

### 深色模式
- Header 太阳/月亮图标一键切换
- 支持 light / dark / system 三种模式
- localStorage 持久化，刷新不丢失
- 页面加载前内联脚本防白闪

### 个人中心
- 账号设置（修改用户名/密码、注销账号需密码确认）
- 我的投稿（视频管理、删除）
- 我的收藏
- 我的点赞（含视频/评论/获赞三个子分类，左侧竖向菜单切换）
- 我的评论（支持查看评论视频还是回复他人）
- 评论跳转（点击评论卡片跳转到视频播放页并定位到目标评论，粉色泛光闪烁 2 下）
- 点击自动播放（从个人中心/首页点击视频封面进入播放页时自动非静音播放）
- 头像菜单快捷入口（个人主页/我的点赞/我的投稿/我的评论/我的收藏/退出登录）

### 管理面板（仅 LZH 用户可访问）
- 头像菜单「管理面板」入口（仅 LZH 登录时显示）
- 网站总览数据（用户/视频/评论/视频点赞/评论点赞/收藏数量统计）
- 用户管理（查看所有用户及数据量，删除用户递归清理关联数据）
- 视频管理（查看所有视频封面+标题+UP主+数据，删除视频递归清理关联数据）
- 评论管理（查看所有评论+视频封面，删除评论递归清理子评论和点赞）
- 视频点赞管理（查看所有视频点赞+封面预览，撤销点赞）
- 评论点赞管理（查看所有评论点赞+视频封面，撤销点赞）
- 收藏管理（查看所有收藏+视频封面，取消收藏）
- 所有管理项支持搜索过滤，删除操作带确认弹窗

### 图片加载优化（弱网优化）
- `optimizedCover()` 智能处理 OSS 和 picsum.photos 两种图片来源
- 所有 `<img>` 添加 `width`/`height`（消除 CLS）、`loading="lazy"`（懒加载）、`decoding="async"`（异步解码）
- `layout.tsx` 添加 OSS 域名 `preconnect` + `dns-prefetch`（提前建立连接）
- OSS 图片添加 `quality,q_80` 质量参数（减小文件体积）
- Aliplayer 播放器封面使用 `optimizedCover(coverUrl, 1280)` 优化
- 未上传封面时使用本地 `public/placeholder.svg`（消除外部依赖）

### 弱网交互优化
- **乐观更新** — 点赞、收藏、评论、回复、评论点赞点击后立即更新 UI，失败时回滚（0 延迟）
- **页面骨架屏** — 首页/播放页/个人中心/搜索页各有独立 `loading.tsx`（animate-pulse 动画）
- **代码分割** — `CommentSection`、`Recommendations`、`AuthModal` 通过 `next/dynamic` 懒加载
- **播放器预加载** — Aliplayer CDN 添加 `<link rel="preload" as="script">` 提前加载
- **API 缓存头** — 推荐视频 60s、视频详情 30s、静态资源 1 年 Cache-Control
- **客户端缓存** — `cachedFetch()` 工具函数，推荐列表 60s、播放列表 5 分钟、VOD playAuth 60s
- **播放列表减量** — 从 50 条减为 20 条

### 不在 MVP 范围

- 弹幕
- 推荐算法
- 分区
- 大会员
- 直播

## 项目架构

```
H:\bilibili/
├── src/
│   ├── app/                         # Next.js App Router 路由
│   │   ├── (auth)/                  # 认证相关路由
│   │   │   ├── login/page.tsx       # 登录页
│   │   │   └── register/page.tsx    # 注册页
│   │   ├── (main)/                  # 主要路由组
│   │   │   ├── page.tsx             # 首页（推荐视频网格布局）
│   │   │   ├── loading.tsx          # 首页骨架屏
│   │   │   ├── upload/page.tsx      # 上传视频页（移动端提示PC端）
│   │   │   ├── video/[id]/page.tsx  # 视频播放页
│   │   │   │   └── loading.tsx      # 播放页骨架屏
│   │   │   ├── profile/page.tsx     # 个人主页（设置/投稿/收藏/点赞/评论）
│   │   │   │   └── loading.tsx      # 个人中心骨架屏
│   │   │   ├── search/page.tsx      # 搜索结果页（视频/评论切换）
│   │   │   │   └── loading.tsx      # 搜索页骨架屏
│   │   │   ├── user/[id]/page.tsx   # 公共用户主页
│   │   │   └── admin/page.tsx       # 管理面板（仅 LZH 可访问）
│   │   └── api/                     # API 路由
│   │       ├── auth/[...nextauth]/  # NextAuth 认证
│   │       ├── register/            # 用户注册
│   │       ├── upload/              # 文件上传（OSS）
│   │       ├── search/              # 搜索 API（视频/评论，部分匹配）
│   │       ├── videos/              # 视频 CRUD
│   │       │   ├── [videoId]/
│   │       │   │   ├── like/        # 视频点赞
│   │       │   │   ├── favorite/    # 视频收藏
│   │       │   │   ├── comments/    # 评论 CRUD
│   │       │   │   │   └── like/    # 评论点赞
│   │       │   │   └── detail/      # 视频详情（含下一个视频ID）
│   │       │   └── recommendations/ # 推荐视频
│   │       ├── vod/                 # VOD 鉴权 API（create/refresh/playAuth）
│   │       ├── admin/               # 管理面板 API（仅 LZH 可访问）
│   │       │   ├── stats/           # 网站数据统计
│   │       │   ├── users/           # 用户管理
│   │       │   ├── videos/          # 视频管理
│   │       │   ├── comments/        # 评论管理
│   │       │   ├── likes/           # 视频点赞管理
│   │       │   ├── comment-likes/   # 评论点赞管理
│   │       │   └── favorites/       # 收藏管理
│   │       └── user/                # 用户相关
│   │           ├── profile/         # 个人信息
│   │           ├── uploads/         # 我的投稿
│   │           ├── favorites/       # 我的收藏
│   │           ├── likes/           # 我的点赞
│   │           ├── comments/        # 我的评论
│   │           ├── comment-likes/   # 我点赞的评论
│   │           ├── comment-received-likes/ # 谁点赞了我的评论
│   │           ├── account/         # 注销账号（DELETE，需密码验证）
│   │           └── [id]/            # 公共用户信息+用户投稿
│   ├── components/                  # React 组件
│   │   ├── auth/                    # 认证相关组件
│   │   │   ├── auth-modal-context.tsx  # 认证弹窗 Context
│   │   │   └── auth-modal.tsx          # 登录/注册弹窗组件
│   │   ├── ui/                      # 通用 UI 组件
│   │   │   └── confirm-dialog.tsx      # 确认弹窗组件
│   │   ├── layout/
│   │   │   └── header.tsx           # 顶部导航（移动端搜索展开动画/深色切换/头像菜单）
│   │   ├── video/
│   │   │   ├── video-card.tsx       # 视频卡片
│   │   │   ├── video-player.tsx     # 视频播放器（Aliplayer 统一播放，桌面端单击/移动端双击暂停）
│   │   │   ├── video-play-section.tsx # 视频播放区（播放器+信息+按钮）
│   │   │   ├── video-like-button.tsx  # 视频点赞按钮
│   │   │   ├── video-favorite-button.tsx # 视频收藏按钮
│   │   │   ├── video-delete-button.tsx  # 视频删除按钮
│   │   │   ├── comment-section.tsx  # 评论区（评论+回复+点赞）
│   │   │   └── recommendations.tsx  # 相关推荐侧栏
│   │   ├── providers.tsx            # 全局 Provider（Session + Theme + AuthModal）
│   │   └── theme-provider.tsx       # 深色模式 Provider
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth 配置 + getSession()
│   │   ├── db.ts                    # Prisma 客户端
│   │   ├── oss.ts                   # 阿里云 OSS 客户端
│   │   ├── vod.ts                   # 阿里云 VOD 服务端封装
│   │   ├── password.ts              # 密码哈希工具（bcryptjs）
│   │   ├── image.ts                 # 图片/URL 优化工具（toHttps + OSS/picsum 图片处理参数生成）
│   │   ├── validation.ts            # zod 输入验证 schema
│   │   ├── csrf.ts                  # CSRF 防护（Origin/Referer 校验）
│   │   ├── rate-limit.ts            # 内存速率限制器
│   │   └── fetch-cache.ts           # 客户端 fetch 缓存工具（TTL + Map 缓存）
│   └── types/index.ts               # TypeScript 类型定义
├── prisma/
│   ├── schema.prisma                # 数据库 schema
│   ├── prisma.config.ts             # Prisma 配置
│   └── dev.db                       # SQLite 数据库文件
├── public/                          # 静态资源
│   ├── favicon.svg                  # 站点图标
│   ├── placeholder.svg              # 视频封面占位图
│   └── lib/                         # 浏览器端 SDK
│       ├── aliyun-upload-sdk-1.5.7.min.js  # VOD 上传
│       ├── aliplayercomponents.min.js       # PlaylistComponent 组件
│       └── lib/                     # VOD 上传依赖
├── .env                             # 环境变量
├── next.config.ts                   # Next.js 配置
├── tsconfig.json                    # TypeScript 配置
└── package.json                     # 项目依赖
```

## 数据模型

### User（用户）
- id: 主键 (cuid)
- name: 用户名（唯一）
- password: 密码（哈希存储）
- avatar: 头像（可选）
- createdAt: 创建时间

### Video（视频）
- id: 主键 (cuid)
- title: 标题
- description: 描述（可选）
- coverUrl: 封面图 URL
- videoUrl: 视频 URL
- vodVideoId: VOD 视频 ID（可选，用于鉴权播放）
- duration: 时长（可选）
- views: 浏览次数
- authorId: 上传者 ID → User
- createdAt: 创建时间

### Comment（评论）
- id: 主键 (cuid)
- content: 评论内容
- videoId: 视频 ID → Video
- authorId: 评论者 ID → User
- parentId: 父评论 ID → Comment（用于回复，可选）
- createdAt: 创建时间

### Like（视频点赞）
- id: 主键 (cuid)
- videoId: 视频 ID → Video
- userId: 用户 ID → User
- createdAt: 创建时间
- 唯一约束: [videoId, userId]

### CommentLike（评论点赞）
- id: 主键 (cuid)
- commentId: 评论 ID → Comment
- userId: 用户 ID → User
- createdAt: 创建时间
- 唯一约束: [commentId, userId]

### Favorite（收藏）
- id: 主键 (cuid)
- videoId: 视频 ID → Video
- userId: 用户 ID → User
- createdAt: 创建时间
- 唯一约束: [videoId, userId]

## 开发指南

### 启动开发服务器

```bash
cd H:\bilibili
npm run dev
```

访问 http://localhost:3005（开发服务器监听 `0.0.0.0:3005`，局域网可通过 `http://<服务器IP>:3005` 访问）

### 数据库操作

```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma db push

# 重置数据库
npx prisma db push --force-reset
```

### 构建验证

```bash
npm run build
```

## 重要注意事项

### 危险命令禁止使用

**Stop-Process -Name "node" -Force（严重）**:
- 此命令会杀死所有名为 "node" 的进程，包括运行 MiMoCode 的 Node.js 进程
- 导致 AI 代理崩溃，用户终端状态异常（鼠标移动出现奇怪字符）
- **绝对禁止使用此命令重启项目**

### 正确的重启方式

```powershell
# 重启 Next.js 开发服务器（推荐）
# 1. 先在终端按 Ctrl+C 停止当前服务
# 2. 然后重新运行
npm run dev

# 仅重启 Prisma（如需要）
npx prisma generate
npx prisma db push
```

### Windows 特殊问题

**PowerShell 方括号通配符陷阱（严重）**:
- Remove-Item "path\[id]" 中的 [id] 会被 PowerShell 解释为通配符
- 删除含方括号的目录必须用 cmd /c "rmdir /s /q path\^ [id]" 转义
- 或使用 \\?\ 前缀的长路径格式

### Next.js 特殊问题

- 同一级路由目录下不能混用不同的动态参数名（如 [id] 和 [videoId]）
- Next.js 15+ 中 params 是 Promise 类型，组件需改为 async
- 根目录的 page.tsx 会与路由组的 page.tsx 冲突
- `useSearchParams()` 必须包裹在 `<Suspense>` 中

### NextAuth 特殊问题

- `auth()` 在未登录/异常时会**抛出异常**（非返回 null），导致 API 返回 500
- 所有 API 路由必须使用 `getSession()`（lib/auth.ts 中定义），内置 try-catch
- `getSession()` 异常时返回 null，前端可正常处理 401

### Prisma 特殊问题

- Prisma v7+ 的 PrismaClient 需要适配器
- PrismaLibSql 构造函数接受 Config 对象，不是 Client 对象
- datasource URL 配置在 prisma.config.ts 中
- prisma.config.ts 不要使用 `earlyAccess: true`（当前版本不支持）

### Tailwind v4 特殊问题

- 深色模式需要在 globals.css 中声明：`@custom-variant dark (&:is(.dark *));`
- 不声明则 `dark:` 前缀不生效

### 类型相关

- `ali-oss` 缺少内置 TypeScript 类型，需要安装 `@types/ali-oss`
- 组件间传递日期字段时，类型应设为 `Date | string` 以兼容 JSON 序列化

### 阿里云 SDK 相关

- **Aliplayer 播放器 CDN**（2.16.3+ 路径变更）：`https://g.alicdn.com/apsara-media-box/imp-web-player/{版本号}/`
- **aliyun-upload-sdk 不在 npm 上**，需手动下载放入 `public/lib/`
- 上传 SDK 加载顺序必须为：es6-promise → aliyun-oss-sdk → aliyun-upload-sdk
- 上传 SDK 的 `enableUploadProgress` 必须设为 `false`（默认 true 会调进度上报 API，userId 校验失败）
- Aliplayer `skinLayout` 只接受 `false` 或数组，不接受 `true`
- **PlaylistComponent 不提供 CDN** — 从 GitHub `aliyunvideo/AliyunPlayer_Web` 下载 `aliplayercomponents-1.1.7.min.js` 放到 `public/lib/`
- **PlaylistComponent 必须在初始化时传入播放列表** — 通过 `args: [playlist]` 参数传入（双层数组），不能在 ready 后调用 `player.setPlayList()`
- **PlaylistComponent 控制条布局** — 组件 `createEl` 中 `controlHtml` 通过 `n.insertBefore(this.controlHtml, i)`（i = `.prism-time-display`）插入到控制栏。图标 class：`icon-skip-previous`（上一个）、`icon-list`（列表）、`icon-skipnext`（下一个）
- **PlaylistComponent 图标 iconfont 需手动补 CSS** — 组件 JS 未内置 iconfont CSS，需通过 CSS `::before` 伪元素 + border 三角形方式渲染图标

## 部署说明

### 环境要求

- Node.js 18+
- Nginx
- 公网服务器

### 部署步骤

1. 构建项目: `npm run build`
2. 将 `.next` 文件夹和 `node_modules` 上传到服务器
3. 配置 Nginx 反向代理
4. 启动 Node.js 服务

### systemd 服务部署（推荐）

```bash
sudo ./deploy.sh install    # 安装服务（自动构建+注册+启动）
sudo ./deploy.sh status     # 查看状态
sudo ./deploy.sh restart    # 重启
sudo journalctl -u bilibili -f  # 查看日志
```
