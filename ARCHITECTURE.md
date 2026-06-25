# Bilibili 风格视频平台 MVP 架构文档

## 项目概述

这是一个仿 Bilibili 的视频平台 MVP（最小可行产品），目标是一天内通过自然语言描述完成基本功能。

## 技术栈

### 核心框架
- **Next.js 16** (App Router) + **TypeScript** — 主框架
- **Tailwind CSS v4** — CSS 工具类框架
- **React 19** — 前端界面
- **zod** — 输入验证库

### 数据库
- **SQLite** (通过 Prisma ORM) — 文件数据库，方便迁移
- **Prisma 6.8+** — 数据库 ORM
- **@prisma/adapter-libsql** — Prisma 适配器

### 认证
- **NextAuth.js 5** (Beta) — 用户认证系统
- **@auth/prisma-adapter** — Prisma 认证适配器

### 视频服务
- **阿里云 OSS** — 视频/封面云存储（Bucket: lolpk，公共读）
- **阿里云 VOD** — 视频点播服务（Region: cn-shenzhen，Space: your-vod-space-name）
- **Aliplayer 2.25.1** — 阿里云播放器 SDK（CDN 引入，统一所有视频播放）
- **aliyun-upload-sdk 1.5.7** — 阿里云 VOD 上传 SDK（本地 public/lib/ 引入）
- **ali-oss** — 阿里云 OSS SDK（Node.js 端）
- **@alicloud/vod20170321** — 阿里云 VOD 服务端 SDK

### 部署
- **Nginx** — Web 服务器
- **公网服务器** — 生产环境部署

## 目录结构

```
H:\bilibili/
├── src/
│   ├── app/                    # Next.js App Router 路由
│   │   ├── (auth)/            # 认证相关路由
│   │   │   ├── login/         # 登录页
│   │   │   └── register/      # 注册页
│   │   ├── (main)/            # 主要路由组
│   │   │   ├── layout.tsx     # 主布局
│   │   │   ├── page.tsx       # 首页（视频卡片网格布局）
│   │   │   ├── upload/        # 上传页
│   │   │   ├── profile/       # 个人主页（账号设置/收藏/点赞/评论）
│   │   │   ├── search/        # 搜索结果页（视频/评论切换）
│   │   │   ├── video/[id]/    # 视频播放页
│   │   │   └── user/[id]/     # 公共用户主页（他人投稿/信息）
│   │   └── api/               # API 路由
│   │       ├── auth/          # NextAuth 认证
│   │       │   └── [...nextauth]/ # NextAuth 路由处理
│   │       │   └── custom-signout/ # 自定义退出登录（绕过NextAuth重定向）
│   │       ├── register/      # 用户注册
│   │       ├── search/        # 搜索 API（视频/评论，任意字符匹配）
│   │       ├── user/          # 用户相关 API
│   │       │   ├── profile/   # 个人资料（GET/PUT）
│   │       │   ├── account/   # 注销账号（DELETE，需密码验证）
│   │       │   ├── favorites/ # 收藏列表
│   │       │   ├── likes/     # 视频点赞列表
│   │       │   ├── uploads/   # 我的投稿列表
│   │       │   ├── comments/  # 我的评论列表
│   │       │   ├── comment-likes/      # 我点赞的评论列表
│   │       │   ├── comment-received-likes/ # 谁点赞了我的评论列表
│   │       │   └── [id]/      # 公共用户信息（GET）+ 用户投稿（GET videos）
│   │       ├── videos/        # 视频相关 API
│   │       │   ├── route.ts   # 视频列表 + 投稿
│   │       │   ├── recommendations/ # 推荐列表
│   │       │   └── [videoId]/
│   │       │       ├── route.ts        # 删除视频
│   │       │       ├── detail/         # 视频详情（含 nextVideoId）
│   │       │       ├── comments/       # 评论 API
│   │       │       │   └── like/       # 评论点赞 API
│   │       │       ├── like/           # 视频点赞 API
│   │       │       └── favorite/       # 视频收藏 API
│   │       ├── upload/        # 文件上传 API（OSS）
│   │       └── vod/           # VOD 视频点播 API（create/refresh/playAuth）
│   ├── components/            # React 组件
│   │   ├── auth/              # 认证相关组件
│   │   │   ├── auth-modal-context.tsx  # 认证弹窗 Context（登录/注册模式切换）
│   │   │   └── auth-modal.tsx          # 认证弹窗组件（Tab 切换登录/注册）
│   │   ├── ui/                # 通用 UI 组件
│   │   │   └── confirm-dialog.tsx      # 确认弹窗组件（替代浏览器 confirm/alert）
│   │   ├── layout/            # 布局组件
│   │   │   └── header.tsx     # 页头组件（移动端搜索展开动画/深色切换/头像菜单）
│   │   ├── providers.tsx      # 全局 Provider（SessionProvider + ThemeProvider + AuthModalProvider）
│   │   ├── theme-provider.tsx # 深色模式 Provider（light/dark/system）
│   │   └── video/             # 视频相关组件
│   │       ├── video-card.tsx             # 视频卡片（同名同色头像）
│   │       ├── video-player.tsx           # 视频播放器（Aliplayer，桌面端单击/移动端双击暂停）
│   │       ├── video-play-section.tsx     # 视频播放区域（含作者信息+推荐列表）
│   │       ├── video-like-button.tsx      # 点赞按钮（服务端初始状态）
│   │       ├── video-favorite-button.tsx  # 收藏按钮（金色星形）
│   │       ├── video-delete-button.tsx    # 删除视频按钮
│   │       ├── recommendations.tsx        # 推荐列表（客户端组件）
│   │       └── comment-section.tsx        # 评论区（回车发送）
│   ├── lib/                   # 工具函数
│   │   ├── auth.ts            # NextAuth 配置 + getSession() 安全封装
│   │   ├── db.ts              # Prisma 客户端
│   │   ├── oss.ts             # 阿里云 OSS 客户端
│   │   ├── vod.ts             # 阿里云 VOD 客户端（CreateUploadVideo/GetVideoPlayAuth/RefreshUploadVideo）
│   │   ├── validation.ts      # zod 输入验证 schema（用户名/密码/评论/视频/搜索）
│   │   ├── csrf.ts            # CSRF 防护（Origin/Referer 校验）
│   │   ├── rate-limit.ts      # 内存速率限制器
│   │   └── password.ts        # 密码哈希工具（bcryptjs）
│   ├── types/                 # TypeScript 类型定义
│   │   └── index.ts           # 共享类型（Video/VideoWithAuthor/Comment/Reply 等）
│   └── generated/             # Prisma 生成的客户端
├── prisma/                    # Prisma 配置
│   ├── schema.prisma          # 数据库 schema
│   ├── prisma.config.ts       # Prisma 配置
│   └── dev.db                 # SQLite 数据库文件
├── public/                    # 静态资源
│   ├── favicon.svg            # 站点图标（bilibili 风格播放按钮）
│   └── lib/                   # 浏览器端 SDK
│       ├── aliyun-upload-sdk-1.5.7.min.js  # VOD 上传 SDK
│       ├── aliplayercomponents.min.js       # Aliplayer PlaylistComponent 组件
│       └── lib/
│           ├── aliyun-oss-sdk-6.17.1.min.js
│           └── es6-promise.min.js
├── .env                       # 环境变量
├── next.config.ts             # Next.js 配置
├── tsconfig.json              # TypeScript 配置
├── deploy.sh                  # systemd 服务部署脚本
└── package.json               # 项目依赖
```

## 数据模型

### User（用户）
- `id`: 主键 (CUID)
- `name`: 用户名（唯一）
- `password`: 密码
- `role`: 角色（默认 "user"）
- `tokenVersion`: 会话版本号（修改密码时递增，用于使旧会话失效）
- `avatar`: 头像 URL
- `createdAt`: 创建时间

### Video（视频）
- `id`: 主键 (CUID)
- `title`: 标题
- `description`: 描述
- `coverUrl`: 封面图 URL（OSS）
- `videoUrl`: 视频 URL（OSS）
- `vodVideoId`: VOD 视频 ID（可选，用于鉴权播放）
- `duration`: 时长（秒）
- `views`: 播放次数
- `authorId`: 上传者 ID
- `createdAt`: 创建时间

### Comment（评论）
- `id`: 主键 (CUID)
- `content`: 评论内容
- `videoId`: 视频 ID
- `authorId`: 评论者 ID
- `parentId`: 父评论 ID（用于回复）
- `createdAt`: 创建时间

### Like（视频点赞）
- `id`: 主键 (CUID)
- `videoId`: 视频 ID
- `userId`: 用户 ID
- `createdAt`: 创建时间

### CommentLike（评论点赞）
- `id`: 主键 (CUID)
- `commentId`: 评论 ID
- `userId`: 用户 ID
- `createdAt`: 创建时间

### Favorite（收藏）
- `id`: 主键 (CUID)
- `videoId`: 视频 ID
- `userId`: 用户 ID
- `createdAt`: 创建时间
- 唯一约束：`(videoId, userId)`

## API 路由

### 认证相关
- `POST /api/register` — 用户注册
- `GET/POST /api/auth/[...nextauth]` — NextAuth 认证

### 搜索相关
- `GET /api/search?q=&type=video|comment` — 搜索视频/评论，任意字符匹配，返回匹配位置

### 用户相关
- `GET /api/user/profile` — 获取当前用户资料（含投稿/获赞/收藏/评论数）
- `PUT /api/user/profile` — 修改用户名/密码
- `GET /api/user/favorites` — 获取收藏列表
- `GET /api/user/likes` — 获取视频点赞列表
- `GET /api/user/uploads` — 获取我的投稿列表
- `GET /api/user/comments` — 获取我的评论列表（含视频信息、父评论信息）
- `GET /api/user/comment-likes` — 获取我点赞的评论列表（含评论、视频、作者信息）
- `GET /api/user/comment-received-likes` — 获取谁点赞了我的评论列表（含评论、点赞者信息）
- `GET /api/user/[id]` — 获取指定用户公开信息（不含密码）
- `GET /api/user/[id]/videos` — 获取指定用户的投稿列表
- `DELETE /api/user/account` — 注销账号（需密码验证，使用事务递归删除用户所有数据，包括视频关联的评论点赞）

### 视频相关
- `GET /api/videos?q=` — 获取视频列表（支持搜索）
- `POST /api/videos` — 投稿（写入数据库）
- `DELETE /api/videos/[videoId]` — 删除视频（仅作者，清理 OSS 文件和关联数据）
- `GET /api/videos/[videoId]/detail` — 获取视频详情（含 nextVideoId、likeCount、favoriteCount、liked、favorited，用于自动连播和切换视频后状态同步）
- `GET /api/videos/recommendations` — 获取推荐列表
- `POST /api/videos/[videoId]/like` — 视频点赞 toggle
- `POST /api/videos/[videoId]/favorite` — 视频收藏 toggle
- `GET /api/videos/[videoId]/favorite` — 查询是否已收藏
- `GET /api/videos/[videoId]/comments` — 获取评论列表（三层嵌套树形结构）
- `POST /api/videos/[videoId]/comments` — 发表评论/回复（支持 parentId 嵌套）
- `DELETE /api/videos/[videoId]/comments` — 删除评论（递归删除所有子孙评论和点赞）
- `POST /api/videos/[videoId]/comments/like` — 评论点赞 toggle

### 文件上传
- `POST /api/upload` — 上传视频/封面文件到阿里云 OSS

### VOD 视频点播
- `POST /api/vod` — VOD 鉴权 API
  - `action: "create"` — 获取上传凭证（需要 title、fileName）
  - `action: "refresh"` — 刷新上传凭证（需要 videoId）
  - `action: "playAuth"` — 获取播放凭证（需要 videoId）

## 环境变量

```env
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

# 阿里云 OSS
OSS_REGION=oss-cn-guangzhou
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=lolpk

# 阿里云 VOD
VOD_REGION=cn-shenzhen
VOD_ACCESS_KEY_ID=your-access-key-id
VOD_ACCESS_KEY_SECRET=your-access-key-secret
VOD_SPACE_NAME=your-vod-space-name
```

## 安全防护

### SQL/NoSQL 注入防护
- 使用 Prisma ORM 参数化查询，所有数据库操作通过 Prisma Client 执行
- 无 `$queryRaw`、`$executeRaw` 等原始 SQL 查询
- 用户输入通过 zod 验证后才传入 Prisma 查询

### XSS 防护
- React 默认转义 JSX 中的变量输出
- `dangerouslySetInnerHTML` 仅用于 layout.tsx 中硬编码的深色模式初始化脚本

### CSRF 防护
- NextAuth 自动保护 `/api/auth/*` 端点
- 高危路由通过 `src/lib/csrf.ts` 验证 Origin/Referer 头
- 支持动态 Host 头匹配，适应不同访问地址
- 高危路由（注册、个人资料修改、投稿、注销、视频删除、管理面板）启用 CSRF 校验
- 低危路由（点赞、收藏、评论）仅依赖 session 认证，未启用 CSRF（性能优化）

### 速率限制
- 使用内存速率限制器（`src/lib/rate-limit.ts`）
- 注册：5 次/IP，窗口 1 小时
- 评论：10 次/用户，窗口 1 分钟
- 上传：5 次/用户，窗口 8 分钟

### 会话安全
- JWT Token 有效期：7 天（`session.maxAge` 和 `jwt.maxAge`）
- 密码修改后会话自动失效：User 模型 `tokenVersion` 字段，修改密码时递增
- JWT 回调对比 token 版本与数据库版本，不一致则标记 `token_revoked`
- NextAuth 默认 Cookie 安全属性：`httpOnly: true`、`secure: true`（生产环境）、`sameSite: lax`

### 输入验证
- 所有用户输入通过 zod schema 验证（`src/lib/validation.ts`）
- 用户名：非空，仅允许字母、数字、下划线、中文
- 密码：非空，无长度限制
- 评论：1-1000 字符
- 视频标题：1-100 字符
- URL：验证格式 + 禁止 `..` 和 `\` 路径穿越序列

### 文件上传安全
- 视频文件大小限制：500MB
- 图片文件大小限制：5MB
- 扩展名白名单：mp4/webm/mov/avi/flv/mkv（视频）、jpg/jpeg/png/gif/webp/bmp（图片）
- 文件名由服务端生成（`timestamp_random.ext`），不使用原始文件名

### 安全响应头（next.config.ts）
- `X-Content-Type-Options: nosniff` — 禁止 MIME 类型嗅探
- `X-Frame-Options: DENY` — 禁止 iframe 嵌入
- `X-XSS-Protection: 1; mode=block` — 启用浏览器 XSS 过滤
- `Referrer-Policy: strict-origin-when-cross-origin` — 控制 Referer 信息
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — 禁用敏感 API
- 未启用 CSP — 与阿里云 Aliplayer VOD 播放器不兼容（VOD 流媒体 CDN 域名动态变化）

### 错误信息脱敏
- 生产环境 API 错误不返回原始错误详情
- 仅记录服务端日志（`console.error`）

## 路径穿越防护
- 文件上传：文件名由服务端生成，不使用原始文件名
- 投稿 URL：zod 验证拒绝含 `..` 或 `\` 的 URL
- OSS 删除：`extractOssKey` 函数过滤 `..` 和 `\` 字符

### 开发环境
```bash
# 启动开发服务器
npm run dev

# 访问 http://localhost:3005
```

### 生产环境
1. **构建项目**
   ```bash
   npm run build
   ```

2. **上传文件到服务器**
   - 上传 `.next` 文件夹
   - 上传 `node_modules` 文件夹
   - 上传 `prisma/dev.db` 数据库文件
   - 视频/封面存储在阿里云 OSS，无需上传

3. **配置 Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3005;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **启动服务**
   ```bash
   npm run start
   ```

### systemd 服务部署（推荐）
使用 `deploy.sh` 脚本将应用注册为 systemd 服务，支持开机自启和后台运行：

```bash
sudo ./deploy.sh install    # 安装服务（自动构建+注册+启动）
sudo ./deploy.sh status     # 查看状态
sudo ./deploy.sh restart    # 重启
sudo journalctl -u bilibili -f  # 查看日志
```

## 依赖包说明

### 核心依赖
- `next@16.2.9` — Next.js 框架
- `react@19.1.0` — React 库
- `react-dom@19.1.0` — React DOM
- `next-auth@5.0.0-beta.28` — 认证系统
- `@auth/prisma-adapter@2.9.0` — Prisma 认证适配器
- `zod` — 输入验证库
- `bcryptjs` — 密码哈希库

### 数据库相关
- `@prisma/client@6.8.2` — Prisma 客户端
- `@prisma/adapter-libsql@6.8.2` — Prisma 适配器
- `prisma@6.8.2` (dev) — Prisma CLI

### UI 相关
- `lucide-react@0.487.0` — 图标库
- `framer-motion` — 页面/列表/微交互动画
- `tailwindcss@4.1.4` (dev) — CSS 框架
- `@tailwindcss/postcss@4.1.4` (dev) — PostCSS 插件

### 云存储
- `ali-oss` — 阿里云 OSS SDK（Node.js 端）
- `@types/ali-oss` (dev) — TypeScript 类型
- `@alicloud/vod20170321` — 阿里云 VOD 服务端 SDK
- `@alicloud/openapi-core` — 阿里云 OpenAPI 核心库
- `@alicloud/tea-util` — 阿里云 Tea 工具库
- `@alicloud/tea-typescript` — 阿里云 Tea TypeScript 类型

### 浏览器端 SDK（public/lib/）
- `aliyun-upload-sdk-1.5.7.min.js` — VOD 上传 SDK（需按顺序加载 es6-promise + aliyun-oss-sdk）
- `aliyun-oss-sdk-6.17.1.min.js` — OSS SDK（VOD 上传依赖）
- `es6-promise.min.js` — Promise polyfill（IE 兼容）

### 开发工具
- `typescript@5.8.3` (dev) — TypeScript 编译器
- `eslint@9.25.1` (dev) — 代码检查
- `eslint-config-next@16.2.9` (dev) — Next.js ESLint 配置

## MVP 功能范围

### 已实现功能
1. **首页** — 视频卡片网格布局，同名同色头像
2. **视频播放页** — 视频播放、点赞、收藏、评论、删除（仅作者）
3. **视频播放器** — Aliplayer 统一播放所有视频（VOD 鉴权播放 / OSS 直链播放），点击视频区域播放/暂停，播放模式切换（循环/单次/自动连播），模式记忆
4. **自动连播** — 不刷新页面切换视频，ready 事件后自动播放，推荐列表同步更新
5. **上传页** — VOD 上传（通过 aliyun-upload-sdk 直传 VOD），失败自动回退 OSS；支持粘贴/拖拽、文件预览、上传进度条
6. **个人主页** — 账号设置、我的投稿（可删除）、收藏列表、点赞列表（含视频/评论/获赞三个子分类）、我的评论
7. **用户系统** — 注册/登录，改名后 Header 实时同步
8. **头像悬浮菜单** — Header 头像悬停 140ms 弹出菜单（含"我的评论"）
9. **基础互动** — 点赞（视频/评论）、收藏、评论（支持多层嵌套回复，递归删除，回车发送）
10. **搜索功能** — 200ms 防抖自动搜索，视频/评论切换，任意字符匹配，红色高亮
11. **深色模式** — Header 太阳/月亮一键切换，支持 light/dark/system，localStorage 持久化
12. **我的评论** — 个人主页评论标签，显示评论视频/回复他人，支持删除
13. **评论跳转** — 从个人中心（点赞/评论列表）点击评论卡片，跳转到视频播放页并自动定位到目标评论，粉色边框+泛光闪烁 2 下高亮
14. **点赞详情** — 我的点赞页面新增左侧竖向菜单，支持查看：视频点赞、我点赞的评论、谁点赞了我的评论
15. **点击自动播放** — 从首页/个人中心/推荐列表点击视频封面进入播放页时，视频自动非静音播放（利用浏览器用户交互策略）
16. **全页面移动端适配** — 所有页面使用 sm: 断点（640px）做移动端/桌面端区分，响应式布局
17. **移动端双击暂停** — 移动端通过 touchend 检测双击（300ms 间隔）暂停/播放视频，桌面端保持单击
18. **Header 移动端搜索动画** — 移动端点击搜索图标展开全宽搜索栏（绝对定位覆盖），收起时淡出
19. **移动端头像菜单** — 移动端点击头像切换菜单开关，桌面端保持 hover 行为
20. **公共用户主页** — `/user/[id]` 显示其他用户的公开信息（投稿数/获赞/收藏）和投稿视频列表
21. **视频播放页作者信息** — 显示作者头像+名字，点击跳转公共主页
22. **投稿页移动端提示** — 移动端显示"投稿功能仅支持PC端"提示，桌面端保持投稿表单
23. **Framer Motion 动画** — 视频卡片 staggered 入场、点赞/收藏按钮弹跳、评论滑入塌陷、推荐列表滑入、头像菜单淡入缩放、视频播放页入场、深色模式过渡动画
24. **个人主页标签动画** — 标签下划线 spring 滑动、标签内容 AnimatePresence 左右滑入滑出、hashchange 监听菜单切换
25. **登录/注册弹窗** — Header 点击登录/注册按钮弹出悬浮弹窗，Tab 切换登录和注册模式，注册成功自动将用户名带入登录表单
26. **用户注销功能** — 个人主页设置标签危险操作区域，自定义确认弹窗（替代浏览器 confirm），输入密码确认注销，后端递归删除所有用户数据
27. **收藏计数显示** — 收藏按钮显示收藏数量，服务端预查询初始状态，实时更新；视频卡片同时显示点赞数和收藏数
28. **播放器控制栏优化** — 上一个/下一个使用 lucide-react 图标，控制栏重新排列（上一个→播放→下一个）
29. **登录/注册弹窗** — Header 点击登录/注册按钮弹出悬浮弹窗，Tab 切换登录和注册模式，注册成功自动将用户名带入登录表单
30. **头像链接优化** — 移动端头像点击切换菜单，桌面端头像点击跳转个人主页

### 未实现功能（不在 MVP 范围）
- 弹幕系统
- 推荐算法
- 视频分区
- 大会员系统
- 直播功能

## 特殊注意事项

### Windows PowerShell 问题
- 删除含方括号的目录时，PowerShell 会将 `[id]` 解释为通配符
- 解决方案：使用 `cmd /c "rmdir /s /q path\^ [id]"` 转义

### Prisma 配置
- Prisma v7+ 需要适配器（`@prisma/adapter-libsql`）
- 数据库路径在 `prisma.config.ts` 中配置
- 生成的客户端入口：`src/generated/prisma/client.ts`
- `prisma.config.ts` 不要使用 `earlyAccess: true`（当前版本不支持）

### NextAuth 注意事项
- `auth()` 未登录时可能**抛出异常**（非返回 null），所有 API 路由必须使用 `getSession()` 安全封装
- `getSession()` 内置 try-catch，异常时返回 null 而非 500 错误
- `jwt` 回调每次刷新都从数据库读取最新用户名，确保改名后 Header 实时同步

### Tailwind v4 深色模式
- 需要在 `globals.css` 中声明：`@custom-variant dark (&:is(.dark *));`
- 不声明则 `dark:` 前缀不生效

### Prisma 类型推断
- Prisma 查询结果在部分环境（如 Linux/CentOS 构建）可能无法自动推断类型，导致变量变为 `any[]`/`any`
- 解决方案：为服务端组件中的 Prisma 查询结果添加显式类型标注
- 已定义共享类型 `VideoWithAuthor`（`src/types/index.ts`），用于首页视频列表
- 视频播放页的 `allVideos`（仅 select id）使用内联类型 `{ id: string }[]`

### 搜索功能
- 使用独立的 `/api/search` 端点（非 `/api/videos`）
- 任意字符匹配：遍历目标文本检查是否包含查询中的任意一个字符
- 匹配到的字符位置全部返回，前端红色加粗高亮
- 搜索结果页面使用 `<Suspense>` 包装 `useSearchParams()`

### 评论系统设计
- 评论支持三层嵌套：根评论 → 回复 → 回复的回复
- 删除评论时递归删除所有子孙评论和关联点赞
- 只有第一层回复有缩进（ml-10），更深层回复不额外缩进
- 主评论框回车直接发送，Shift+Enter 换行

### 视频播放器
- 统一使用 Aliplayer 2.25.1 播放所有视频（VOD 和 OSS），不再使用原生 `<video>` 标签
- VOD 视频：通过 `vid + playauth` 鉴权播放；OSS 视频：通过 `source` 直链播放
- 桌面端点击视频区域（非控件）切换播放/暂停：白名单方式监听 `<video>`、封面、大播放按钮的 click 事件
- 移动端通过 `touchend` 事件检测双击（300ms 间隔）切换播放/暂停，桌面端保持单击
- 播放模式：循环播放（ended 时 seek+play）、单次播放（自然停止）、自动连播（ended 时跳转下个视频，ready 事件后自动播放）
- 播放模式按账号记忆（localStorage），未登录按浏览器会话记忆（sessionStorage）
- **事件监听器管理** — click/touchend 监听器通过变量保存引用，在 useEffect cleanup 中正确移除，避免视频切换时监听器叠加
- **播放/暂停中心动画** — 自建 `.bili-anim` overlay div（不依赖 Aliplayer 内部 `.prism-animation`），监听 `player.on('play')`/`player.on('pause')` 事件触发弹性缩放动画（0.7s ease-out，18vw/18vh 响应尺寸）
- **PlaylistComponent 播放列表组件** — 阿里云官方组件（不提供 CDN），从 GitHub 下载 `aliplayercomponents-1.1.7.min.js` 放到 `public/lib/`。通过 `components` 配置注册，初始化时通过 `args: [playlist]` 传入播放列表。控制条添加上一个/播放列表/下一个按钮，列表按钮通过 CSS 隐藏
- **视频切换** — 上一个/下一个按钮使用 lucide-react 的 SkipBack/SkipForward 图标（通过 createRoot 渲染），控件栏重排（上一个→播放/暂停→下一个），隐藏播放列表按钮。tooltip 通过 mouseenter/mouseleave 事件绑定 `.visible` class 切换。切换逻辑：fetch detail API + replaceState + onVideoChange 回调
- **点击自动播放**：从视频卡片（首页/个人中心/推荐列表）点击进入播放页时，通过 sessionStorage 传递 autoPlayVideo 标记，播放器检测到标记后自动非静音播放，播放后立即清除标记
- **Favicon** — 添加 `public/favicon.svg`（bilibili 风格播放按钮图标），在 `layout.tsx` 中引用

### 评论跳转功能
- 个人中心的"我的点赞"和"我的评论"页面支持点击评论卡片跳转到视频播放页
- 跳转使用 sessionStorage 存储目标评论 ID（highlightComment），避免 Next.js 客户端导航丢失 URL hash
- 评论区组件读取 sessionStorage 后，轮询等待目标评论 DOM 渲染完成
- 定位方式：手动累加 offsetParent 的 offsetTop 计算绝对位置，window.scrollTo 平滑滚动
- 高亮效果：粉色边框（2px #FB7299）+ 泛光（12px rgba(251,114,153,0.4)），闪烁 2 下（亮→灭→亮→灭），每次 500ms 淡入淡出
- 评论区渲染时为每条评论和回复添加 `id={`comment-${comment.id}`}` 属性

### 文件上传
- VOD 上传：通过 `aliyun-upload-sdk` 直传阿里云 VOD，服务端获取凭证，客户端 SDK 分片上传
- OSS 上传：VOD 失败时自动回退，通过 `/api/upload` 上传到阿里云 OSS（ali-oss SDK），Bucket 为公共读权限
- 文件路径：`videos/{时间戳}_{随机字符串}.{扩展名}`、`covers/{时间戳}_{随机字符串}.{扩展名}`
- 删除视频时同步删除 OSS 文件
- 投稿页文件选择器使用自定义按钮，粘贴/拖拽后正确显示文件名

### VOD 视频点播
- 服务端使用 `@alicloud/vod20170321` SDK，通过 `createUploadVideo` 获取上传凭证
- 客户端使用 `aliyun-upload-sdk 1.5.7`（本地 `public/lib/` 引入），需按顺序加载 es6-promise → aliyun-oss-sdk → aliyun-upload-sdk
- 上传 SDK API：`new AliyunUpload.Vod(options)` → `addFile()` → `startUpload()` → `onUploadstarted` 回调中调 `setUploadAuthAndAddress()`
- 上传 SDK 的 `enableUploadProgress: false`（关闭进度上报，避免 `InvalidUserId` 错误）
- 播放器使用 Aliplayer 2.25.1（CDN `g.alicdn.com/apsara-media-box/imp-web-player/2.25.1/`），所有视频统一使用 Aliplayer 播放
- VOD 视频通过 `vid + playauth` 鉴权播放，OSS 视频通过 `source` 直链播放
- VOD 上传失败时自动回退到 OSS 上传，保证投稿功能不受影响
- `public/lib/` 目录包含浏览器端 VOD 上传 SDK 文件，需随项目部署

### 用户注销功能
- 个人主页设置标签"危险操作"区域，使用自定义 ConfirmDialog 弹窗确认（替代浏览器 confirm）
- 后端 `DELETE /api/user/account` 校验密码后级联删除：评论点赞→评论→视频点赞→收藏→视频→用户
- 注销后自动跳转首页并退出登录

### 自定义确认弹窗
- 新增 `src/components/ui/confirm-dialog.tsx` 通用组件，替代浏览器原生 `confirm()`/`alert()`
- 支持标题、消息、确认/取消按钮文本、danger 模式（红色按钮）
- framer-motion 动画（淡入淡出 + 缩放），z-index 110（高于认证弹窗的 100）
- 当前用于用户注销确认

### 退出登录跳转
- Header 退出登录：调用 `/api/auth/custom-signout` 清除 cookie 后 `window.location.reload()`
- 个人主页未登录检测：自动跳转首页 `/`（非 login 页面）

### 收藏按钮优化
- 支持 `initialFavorited` 和 `initialCount` props，服务端预查询初始状态
- 显示收藏数量（count > 0 时显示数字）
- 收藏/取消收藏时实时更新数量（setCount）

### 头像颜色
- Header、个人主页、视频卡片统一使用**用户名**计算头像颜色
- 改名后头像颜色自动同步变化

### 阿里云 SDK 相关
- **Aliplayer 播放器 CDN**（2.16.3+ 路径变更）：`https://g.alicdn.com/apsara-media-box/imp-web-player/{版本号}/`
- **aliyun-upload-sdk 不在 npm 上**，需手动下载放入 `public/lib/`
- 上传 SDK 加载顺序必须为：es6-promise → aliyun-oss-sdk → aliyun-upload-sdk
- 上传 SDK 的 `enableUploadProgress` 必须设为 `false`（默认 true 会调进度上报 API，userId 校验失败）
- Aliplayer `skinLayout` 只接受 `false` 或数组，不接受 `true`
- Aliplayer 2.25.1 的 CSS 类名：控件 `.prism-control-bar`、封面 `.prism-cover`/`.prism-poster`、大播放按钮 `.prism-big-play-btn`
