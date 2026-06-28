# Bilibili MVP 进度文档

## 当前状态：原版功能合并已完成

开发服务器：http://localhost:3005

## 已完成工作

### 基础框架
- Next.js 16 + TypeScript 项目搭建
- Tailwind CSS v4 配置
- Prisma ORM + SQLite 数据库
- NextAuth.js v5 用户认证

### 页面功能
- **首页** — 视频卡片网格布局（响应式 2/3/4/5 列）
- **视频播放页** — 视频播放、点赞、收藏、评论、删除（仅作者）、播放模式切换
- **上传页** — 真实文件上传到阿里云 OSS（视频+封面），支持粘贴/拖拽、文件预览、上传进度条
- **个人主页** — 账号设置、我的投稿（可删除）、收藏列表、点赞列表（含视频/评论/获赞三个子分类，左侧竖向菜单切换）、我的评论（含删除）
- **用户系统** — 注册/登录，改名后 Header 实时同步
- **搜索页** — 视频/评论搜索，任意字符匹配，红色高亮，200ms 防抖自动搜索
- **我的评论** — 个人主页评论标签，统一查看所有评论，区分评论视频/回复他人，支持删除（已合并，独立页面已移除）

### 交互功能
- **头像悬浮菜单** — 悬停 140ms 弹出菜单（个人主页、我的投稿、我的评论、我的点赞、我的收藏、退出）
- **收藏按钮** — 视频播放页金色星形收藏按钮
- **评论系统** — 三层嵌套回复、递归删除、评论点赞、回车发送
- **视频点赞** — 点赞/取消点赞，服务端查询初始状态
- **视频播放器** — 暂停遮罩、播放模式切换（循环/单次/自动连播）、模式记忆
- **播放/暂停中心动画** — 自建 overlay div + 弹性缩放动画（player.on('play')/('pause') 事件触发）
- **视频切换** — PlaylistComponent 原生上一个/下一个按钮（CSS 三角形图标），tooltip 通过 class 切换显示，键盘 ←→ 快捷键
- **PlaylistComponent 集成** — 从 GitHub 下载 aliplayercomponents.min.js，通过 args 传入播放列表，隐藏列表按钮只保留切换按钮
- **深色模式** — Header 太阳/月亮一键切换，支持 light/dark/system，localStorage 持久化
- **评论跳转** — 从个人中心点击评论卡片跳转到视频播放页，自动定位到目标评论并闪烁高亮
- **点击自动播放** — 从首页/个人中心/推荐列表点击视频封面进入播放页时，视频自动非静音播放

### VOD 视频点播（已完成）
- **VOD 服务端鉴权** — 使用官方 SDK `@alicloud/vod20170321`，CreateUploadVideo API 调用成功
- **VOD 客户端上传** — 通过 `aliyun-upload-sdk 1.5.7`（本地 public/lib/），addFile + startUpload + setUploadAuthAndAddress 流程
- **VOD 鉴权播放** — Aliplayer 2.25.1 统一播放所有视频，VOD 视频通过 vid+playauth 鉴权播放
- **VOD 回退 OSS** — VOD 失败时自动回退到 OSS 上传，保证投稿不受影响
- **Aliplayer 统一播放器** — 所有视频（VOD + OSS）统一使用 Aliplayer 播放，不再使用原生 `<video>` 标签
- **浏览器 SDK 文件** — public/lib/ 包含 aliyun-upload-sdk、aliyun-oss-sdk、es6-promise

### 管理面板（仅 LZH 用户可访问）
- **管理面板入口** — 头像菜单「管理面板」条目，仅 LZH 登录时显示，跳转 /admin 页面
- **网站总览** — 用户/视频/评论/视频点赞/评论点赞/收藏数量统计卡片
- **用户管理** — 查看所有用户及数据量（视频/评论/点赞/收藏数），支持搜索，删除用户递归清理所有关联数据
- **视频管理** — 查看所有视频封面+标题+UP主+数据（播放/点赞/评论/收藏），支持搜索，删除视频递归清理关联数据
- **评论管理** — 查看所有评论+视频封面，显示评论内容/作者/所属视频/点赞/回复数，支持搜索，删除评论递归清理子评论和点赞
- **视频点赞管理** — 查看所有视频点赞+封面预览，显示用户→视频关系，支持搜索，撤销点赞
- **评论点赞管理** — 查看所有评论点赞+视频封面，显示用户→评论关系，支持搜索，撤销点赞
- **收藏管理** — 查看所有收藏+视频封面，显示用户→视频关系，支持搜索，取消收藏
- **权限控制** — 所有管理 API 校验 session 用户名 === "LZH"，非管理员返回 403
- **删除确认弹窗** — 所有删除/撤销操作弹出确认对话框，防止误操作

### 安全防护（已完成）
- **SQL/NoSQL 注入防护** — 使用 Prisma ORM 参数化查询，无原始 SQL，所有输入通过 zod 验证
- **XSS 防护** — React 默认转义，`dangerouslySetInnerHTML` 仅用于硬编码脚本
- **CSRF 防护** — 新增 `src/lib/csrf.ts`，高危路由（注册/投稿/注销/管理面板）验证 Origin/Referer，支持动态 Host 匹配
- **速率限制** — 新增 `src/lib/rate-limit.ts`，注册 5次/IP·小时，评论 10次/用户·分钟，上传 5次/用户·8分钟
- **输入验证** — 新增 `src/lib/validation.ts`，zod schema 覆盖用户名（无长度限制）/密码（无长度限制）/评论/视频/搜索，含路径穿越防护
- **文件上传安全** — 视频 500MB/图片 5MB 大小限制，扩展名白名单，文件名服务端生成
- **安全响应头** — next.config.ts 添加 X-Content-Type-Options/X-Frame-Options/X-XSS-Protection/Referrer-Policy/Permissions-Policy（CSP 因与 Aliplayer VOD 不兼容已移除）
- **路径穿越防护** — 投稿 URL 验证拒绝 `..` 和 `\`，OSS 删除过滤非法路径
- **错误信息脱敏** — 生产环境 API 错误不返回原始错误详情
- **会话安全** — JWT 7 天有效期，User 新增 `tokenVersion` 字段，修改密码时递增使旧会话失效
- **敏感信息防护** — API 不返回密码/密钥/堆栈信息，生产环境错误脱敏，无 SSRF/命令注入攻击面
- **已删除用户 token 撤销** — JWT 回调中用户不存在时自动标记 token_revoked，防止已删除用户残留登录状态
- **退出登录跳转修复** — 新增 `/api/auth/custom-signout` 自定义 API，绕过 NextAuth 服务端重定向，正确清除 authjs.* cookie，使用当前页面地址跳转
- **个人主页错误处理** — API 返回错误时自动跳转首页，防止 null 数据崩溃

### 本次会话新增/修复
- **弱网图片加载优化** — 全面优化弱网环境下图片加载性能
  - `optimizedCover()` 支持 picsum.photos 图片缩放（替换 URL 末尾尺寸参数，请求小尺寸版本）
  - 所有 `<img>` 标签添加 `width`/`height`（消除 CLS）、`decoding="async"`（异步解码）
  - `layout.tsx` 添加 OSS 域名 `preconnect` + `dns-prefetch`（提前建立连接）
  - OSS 图片添加 `quality,q_80` 质量参数（减小文件体积）
  - Aliplayer 播放器封面调用 `optimizedCover(coverUrl, 1280)` 优化
  - 未上传封面时使用本地 `public/placeholder.svg`（消除 picsum.photos 外部依赖）
  - 涉及文件：`image.ts`、`layout.tsx`、`video-card.tsx`、`video-player.tsx`、`recommendations.tsx`、`profile/page.tsx`、`search/page.tsx`、`admin/page.tsx`、`user/[id]/page.tsx`、`upload/page.tsx`、`api/videos/route.ts`
- **原版功能合并** — 从 bilibili 原版合并图片优化功能到 Qbilibili
  - 新增 `src/lib/image.ts` 工具函数（`toHttps()` + `optimizedCover()`）
  - 首页添加 `export const dynamic = "force-dynamic"` 避免静态缓存
  - 上传页修复 `videoUrl: videoUrl || undefined` 空值处理
  - 9 个文件添加 `optimizedCover()` + `loading="lazy"` 懒加载
- **Linux 构建类型修复** — Prisma 查询结果在 CentOS 构建时无法自动推断类型，导致隐式 any 错误
  - `src/app/(main)/page.tsx` — 添加 `VideoWithAuthor[]` 类型标注
  - `src/app/(main)/video/[id]/page.tsx` — 添加 `{ id: string }[]` 类型标注
  - `src/types/index.ts` — 新增 `VideoWithAuthor` 接口定义
- **Bug 批量修复** — 子代理全面审查后修复 15+ 个 bug
  - 视频播放器事件监听器泄漏修复（click/touchend 在 cleanup 中移除）
  - 切换视频后点赞/收藏状态不更新（detail API 新增 likeCount/favoriteCount/liked/favorited，逐层传递）
  - 用户注销改用 `$transaction` 事务 + 补全评论的子评论 commentLike 清理
  - 视频删除改用 `$transaction` 事务，删除顺序修正（先 commentLike 再 comment）
  - 管理员评论删除改为递归处理所有层级子评论
  - 搜索历史点击双重导航修复（移除重复 handleSearchInput 调用）
  - 搜索结果简介匹配显示错误修复（显示 description 而非 title）
  - 评论高亮 ref 在视频切换后正确重置
  - user/[id] 页面 params Promise 依赖改为先 resolve 再请求，避免重复请求
  - NEXTAUTH_SECRET 更换为随机强密钥
- **systemd 服务部署脚本** — 新增 `deploy.sh`，支持一键安装为 systemd 服务（install/uninstall/start/stop/restart/status）
  - user/[id] 页面 params Promise 依赖改为先 resolve 再请求
  - NEXTAUTH_SECRET 更换为随机强密钥（所有已登录用户需重新登录）
- **收藏功能优化** — 收藏按钮显示收藏数量，初始状态通过服务端查询传入（不再客户端额外请求），收藏/取消收藏时实时更新数量；视频卡片同时显示点赞数和收藏数
- **播放器控制按钮优化** — 上一个/下一个按钮使用 lucide-react 的 SkipBack/SkipForward 图标替换 CSS 三角形，重新排列控制栏布局（上一个→播放→下一个）
- **登录/注册弹窗** — Header 点击登录/注册按钮打开悬浮弹窗，Tab 切换登录和注册模式，注册成功自动填充用户名到登录表单
- **头像链接优化** — 移动端头像点击切换菜单（toggle），桌面端头像点击跳转个人主页
- **全页面移动端适配** — 所有页面使用 sm: 断点（640px）做移动端/桌面端区分
  - Header：搜索栏和间距收紧，logo 字号缩小
  - 首页：间距收紧，网格响应式 2→3→4→5 列
  - 视频播放页：播放器/标题/按钮/推荐区间距紧凑化
  - 评论区：卡片内边距、回复框缩进和宽度适配移动端
  - 个人中心：Tab 栏紧凑排列、点赞子菜单移动端改为横排、评论卡片竖排
  - 搜索页：标题和按钮竖排、评论卡片竖排缩略图
  - 投稿页：间距收紧
- **移动端双击暂停** — 移动端通过 touchend 检测双击（300ms 间隔）暂停/播放视频，桌面端保持单击
- **Header 移动端搜索动画** — 移动端点击搜索图标展开全宽搜索栏（绝对定位覆盖+背景色），收起时淡出；桌面端保持始终可见
- **移动端头像菜单** — 移动端点击头像切换菜单开关（toggleMenu），桌面端保持 hover 行为
- **投稿页移动端提示** — 移动端显示"投稿功能仅支持PC端"提示（显示器图标），桌面端保持投稿表单
- **个人中心 Tab 优化** — 移动端缩小字号（text-sm）和间距（px-2.5 gap-0.5），标签缩短，无需横向滚动
- **个人中心点赞子菜单间距** — Tab 栏与内容区间距从 mt-6 缩小到 mt-2（移动端）
- **个人中心 Tab 右侧渐变淡出** — 绝对定位渐变遮罩提示右侧内容
- **公共用户主页** — 新增 `/user/[id]` 页面，显示用户头像、名字、投稿/获赞/收藏数，以及该用户的投稿视频列表；查看自己主页自动重定向到 /profile
- **公共用户 API** — 新增 `GET /api/user/[id]` 和 `GET /api/user/[id]/videos`
- **视频播放页作者信息** — 显示作者头像+名字，点击跳转公共主页
- **自动连播修复** — autoPlayRef 在新播放器初始化时未被检查，导致自动连播失效；修复为 ready 事件同时检查 shouldAutoPlay 和 autoPlayRef
- **VOD 客户端上传完成** — 修复 SDK 加载路径（aliplayer-min.js → aliyun-upload-sdk）、API 调用流程（initUpload → addFile+startUpload）、回调注册方式（.on → 构造函数 options）、enableUploadProgress 关闭
- **Aliplayer 播放器统一** — CDN 地址从 aps/alicloud-media-player/2.18.1 更新为 apsara-media-box/imp-web-player/2.25.1
- **播放器容器修复** — 使用 containerRef + id 直接挂载，不再用 innerHTML 动态创建
- **播放器点击交互** — 白名单方式监听 video/封面/大播放按钮的 click 切换播放暂停，不干扰控件
- **循环播放修复** — Aliplayer 无 loop 属性，ended 事件中手动 seek(0)+play()
- **自动连播修复** — autoPlayRef 标记连播跳转，ready 事件后自动播放
- **模式切换不重载** — modeRef 替代 mode 在 useEffect 依赖中，切换模式不重新初始化播放器
- **控件常驻显示** — CSS 覆盖 .prism-control-bar 的 opacity 和 transition
- **个人中心点赞详情** — 新增 API `/api/user/comment-likes` 和 `/api/user/comment-received-likes`，支持查看我点赞的评论和谁点赞了我的评论
- **点赞页面左侧竖向菜单** — 点赞 tab 下新增视频/评论/获赞三个子分类，左侧竖向菜单切换
- **评论跳转功能** — 个人中心点赞/评论列表点击卡片跳转到视频播放页，sessionStorage 传递评论 ID，轮询等待 DOM 渲染后精确滚动定位
- **评论高亮闪烁** — 目标评论显示粉色边框+泛光效果，闪烁 2 下（亮→灭→亮→灭），每次 500ms 淡入淡出
- **点击自动播放** — 视频卡片点击时存 sessionStorage autoPlayVideo 标记，播放器检测后自动非静音播放
- **弱网交互优化** — 全面优化弱网环境下页面交互响应速度
  - **乐观更新** — 点赞、收藏、评论、回复、评论点赞全部改为点击后立即更新 UI，失败时回滚，弱网下操作响应从 1-3 秒降为 0 延迟
  - **页面骨架屏** — 新增 4 个 `loading.tsx`（首页/播放页/个人中心/搜索页），页面导航时立即显示页面结构，消除白屏
  - **代码分割** — `CommentSection`、`Recommendations`、`AuthModal` 通过 `next/dynamic` 懒加载（含骨架屏 fallback），视频播放页首屏 JS 减少约 30%
  - **播放器预加载** — `layout.tsx` 中添加 Aliplayer CDN 的 `<link rel="preload" as="script">` 预加载
  - **API 缓存头** — `next.config.ts` 为推荐视频（60s）、视频详情（30s）、静态资源（1年 immutable）设置 Cache-Control
  - **客户端 fetch 缓存** — 新建 `src/lib/fetch-cache.ts`，推荐列表 60s 缓存、播放列表 5 分钟缓存、VOD playAuth 60s 缓存
  - **播放列表减量** — 播放列表从 50 条减为 20 条，减少首屏传输体积
- **Framer Motion 动画系统** — 安装 framer-motion 库，全面添加页面动画
  - 首页/搜索结果视频卡片 staggered fade-in 入场（依次淡入上移）
  - 点赞按钮 whileTap 缩放 + liked 弹跳动画
  - 收藏按钮 whileTap 缩放 + favorited 弹跳动画
  - 评论区 AnimatePresence：新评论滑入、删除评论滑出
  - 推荐列表 staggered 滑入动画
  - 头像菜单 AnimatePresence 淡入缩放滑入动画
  - 视频播放页主内容区和侧边栏入场动画
  - 搜索结果页视频/评论卡片 staggered 入场
- **深色模式过渡动画** — CSS class `.dark-transition` + JS 时序控制，切换时背景色/文字色/边框色 0.3s 渐变
- **个人主页标签动画** — 标签下划线 spring 滑动（layoutId）、标签内容 AnimatePresence 左右滑入滑出、hashchange 监听菜单切换、useRef 方向计算
- **个人主页评论删除动画** — framer-motion layout 动画，删除时高度塌陷+淡出，剩余评论平滑上移
- **头像菜单修复** — 修复菜单切换标签时 hashchange 双触发导致动画方向异常，移除多余 dispatchEvent

### 之前会话已完成的功能
- 阿里云 OSS 接入 — 视频和封面上传到 OSS
- 视频删除 — 作者可删除自己的视频（播放页按钮 + 个人主页列表）
- 视频播放器 — 暂停遮罩、播放模式切换、模式记忆
- 自动连播 — 不刷新页面切换视频，保持用户交互上下文
- 收藏功能（数据库 Favorite 模型 + API）
- 个人主页 `/profile`（修改用户名/密码）
- 我的投稿、收藏列表、点赞列表页面
- 投稿页支持 Ctrl+V 粘贴和拖拽文件上传
- 评论系统 — 三层嵌套回复、递归删除、评论点赞
- 头像菜单 — 悬停弹出菜单
- 搜索功能 — 任意字符匹配、红色高亮、视频/评论切换、200ms 防抖
- 深色模式 — ThemeProvider、localStorage 持久化、防白闪脚本
- 我的评论 — 已合并到个人主页标签（独立页面已移除）

### 之前会话修复的 Bug
- **auth() 异常崩溃**（严重）— 所有 API 路由的 `auth()` 改为 `getSession()`（内置 try-catch）
- **投稿 API 缺失** — 创建 `/api/videos` POST 路由
- **投稿后页面不刷新** — 改为 `window.location.href` 全页刷新
- **视频卡片作者名硬编码** — 从 "UP" 改为显示真实 author.name
- **视频 URL 字段名错误** — Prisma schema 字段是 `videoUrl`，播放页和删除 API 错写为 `url`
- **自动连播失效** — autoPlayRef 在新播放器初始化时未被检查，修复为 ready 事件同时检查 shouldAutoPlay 和 autoPlayRef

## 下一步打算

### 短期
1. **加载骨架屏** — 首页/搜索页/播放页添加 Skeleton 加载动画
2. **VOD 断点续传** — 上传中断后恢复（aliyun-upload-sdk 支持 checkpoint）

### 中期
6. **无限滚动分页** — 首页视频列表无限滚动加载
7. **Toast 消息提示** — 轻量级提示框替代 alert/confirm 弹窗
8. **视频编辑功能** — 支持修改标题/描述
9. **视频详情优化** — 播放量统计、点赞数实时更新

### 长期
10. **性能优化** — 代码分割、首屏加载优化
11. **监控日志** — 错误监控、用户行为分析

## 技术债务
- 密码明文存储，生产环境需用 bcrypt 哈希
- OSS AccessKey 存在 .env 中，生产环境应使用 RAM 子账号

## 已知问题
- 评论递归删除仅支持三层嵌套（API端 collectDescendants 递归实现）
- 部分图标使用 lucide-react，未完全统一风格
- 投稿页无法复制输入框外的文字（浏览器层面问题，非代码导致）
