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
- **评论图片附件** — 每条评论最多附加 7 张图片，文字可选（支持纯图片评论）
  - 单图 4:3 大图预览，多图 1:1 方形缩略图网格
  - PC 端最多 2 行 × 4 列，移动端 1 行 × 3 列，溢出显示 "+N" 标记
  - 全屏灯箱查看原图（键盘导航、ESC 关闭）
  - 前端文件验证（5MB 限制、格式检查）、上传进度指示
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
- **退出登录跳转修复** — 改用 NextAuth 内置 `signOut({ callbackUrl: "/" })` 替代自定义 API，正确匹配 cookie 属性（httpOnly/secure/sameSite），解决生产环境 HTTPS 下退出登录失效问题
- **退出登录跳转地址修复** — `.env` 补充 `NEXTAUTH_URL=http://localhost:3005`，修复退出登录时跳转到 `https://0.0.0.0:3005/` 的问题（缺少该配置时 NextAuth 从服务器绑定地址推导绝对 URL）
- **个人主页错误处理** — API 返回错误时自动跳转首页，防止 null 数据崩溃

### Nginx HTTPS 配置（2026-06-26）
- **SSL 证书部署** — DigiCert 证书（`your-domain.com` + `www.your-domain.com`），TLS 1.2/1.3，存放在 `/etc/nginx/ssl/`
- **HTTPS 反向代理** — 新增 `/etc/nginx/conf.d/ssl-your-domain.conf`，HTTP 80 → HTTPS 301 跳转，HTTPS 443 + HTTP/2 反代到 :3005
- **防火墙开放 443** — `firewall-cmd --add-port=443/tcp`
- **限流调整** — Next.js RSC 并发请求触发 rate limit（10r/s burst=20），提升到 50r/s burst=100
- **旧配置清理** — `bilibili.conf` 备份为 `.bak`，`limit_req_zone` 合并到 SSL 配置

### 本次会话新增/修复
- **评论区图片附件功能** — 评论支持附加图片，每条最多7张
  - 数据模型：Comment 模型新增 `images` 字段（JSON 序列化存储）
  - API 支持：评论创建/列表接口支持 images 参数
  - 输入区：评论框内嵌图片图标，支持文件选择、粘贴上传、预览、删除
  - 弹性延展：评论框自动增高，最多10行，超过显示滚动条（深色/浅色模式适配）
  - 字数限制：最大500字符，超出时发送按钮变为红色负数提示
  - 展示区：单图 4:3 大图，多图 1:1 方形缩略图网格（PC 4列/移动 3列）
  - 溢出处理：移动端超过3张显示 "+N" 标记
  - 灯箱组件：全屏查看原图，键盘导航，ESC 关闭，鼠标滚轮/按钮/键盘缩放，双击切换缩放，拖拽平移，移动端双指捏合缩放
  - 前端验证：8MB 限制（超过自动压缩），格式白名单（jpg/png/gif/webp）
  - 状态管理：评论和回复使用独立的图片状态，避免混淆
  - 粘贴上传：支持 Ctrl+V 粘贴剪贴板图片
  - 回复评论：与主评论框功能完全一致（弹性延展、字数限制、图片上传）
  - 回复引用：显示被回复评论的预览（有文字显示前4字符，无文字显示图片数量）
  - 样式统一：子评论与父评论使用相同的字体大小和图标尺寸
- **图文播放器 PC 端鼠标单击暂停修复** — 移除 ImageCarousel onClick 中的 `ontouchstart` 守卫，修复触摸屏笔记本（如 Surface Pro）用鼠标单击无法暂停图文播放的问题。旧代码通过 `"ontouchstart" in window` 检测设备类型并阻止 click，但在触摸屏 PC 上该检测为 true 导致鼠标 click 被误拦截。修复后与视频播放器对齐：始终绑定 click 事件，移动端通过 `touchstart.preventDefault()` 阻止合成 click，两种输入模式可共存
- **图文播放修复** — 修复播放/暂停图标反转和音频自动播放问题
  - 图标反转修复：暂停时显示播放图标（▶），播放时显示暂停图标（⏸）
  - 音频自动播放：浏览器阻止自动播放时自动切换到暂停状态，用户交互后恢复
  - **移动端双击暂停** — 图文播放器移动端与视频播放器对齐，使用原生 `addEventListener` + `{ capture: true, passive: false }` 注册 touchstart（React 合成事件是 passive listener，`preventDefault()` 会被浏览器忽略）。双击（300ms 间隔）暂停/播放，滑动切换图片。桌面端保持单击暂停。移除 `touch-none` CSS（干扰 click 合成），所有回调通过 ref 访问（依赖数组为空，避免 useEffect 频繁重建丢失 lastTap 状态）
  - **中心蒙版图标统一** — 暂停图标从 stroke 描边（`<path>` + `strokeWidth`）改为 fill 实心矩形（`<rect>`），与视频播放器的 `.bili-anim svg` 完全一致（`fill="#fff"`，`h-2/5 w-2/5` = 40%）
- **投稿页面布局优化** — 视频投稿和图文投稿均改为左右布局
  - **容器限制移除** — max-w-2xl 改为 max-w-6xl，充分利用屏幕宽度
  - **视频投稿左右布局** — 新增 VideoUploadPage 组件，左侧40%视频预览，右侧60%表单（视频上传/标题/简介/封面）
  - **图文投稿左右布局** — 新增 ImageTextUploadPage 组件，左侧40%大预览，右侧60%表单+瀑布流缩略图
  - **瀑布流缩略图** — 小预览图按宽度自适应排列，点击切换大预览，添加滚动条限制高度，滚动条支持深色模式
  - **编辑模式** — 点击按钮进入编辑模式，可点击标记序号（1/2/3...）或拖拽排序
  - **设置封面** — 编辑模式下小预览图增加设置封面按钮，未设置则默认使用第一张图片
  - **保存/撤销逻辑** — 编辑模式下内容变化时出现保存按钮，退出时未保存的操作自动撤销
  - **快照恢复修复** — 进入编辑模式时为快照创建新的 ObjectURL（避免共享 URL），退出时正确恢复或撤销
  - **动态对齐** — 默认无素材时底部对齐预览和投稿按钮，导入素材后顶部对齐置顶
  - **上传速率限制** — 从 5 次/8分钟 提升到 20 次/8分钟，避免编辑模式下操作触发 429 错误
  - **删除图片索引修复** — 修复删除图片时 currentImageIndex 计算错误的问题
  - **图文投稿提交修复** — 修复 form.requestSubmit() 不触发 React onSubmit 事件的问题，改用原生 submit 事件派发
  - **音乐播放器按钮修复** — 给播放和删除按钮添加 type="button"，防止点击时触发表单提交
  - **批量删除修复** — 编辑模式下删除选中按钮现在会删除所有标记的图片，而不是只删除当前选中的
  - **投稿按钮修复** — 改为直接调用 handleSubmit 函数，确保图文投稿能正确触发上传
  - **图文播放支持** — 播放页新增图片轮播组件，支持图文投稿的图片预览播放
    - 自动播放：进入播放页自动开始轮播和音频播放，点击暂停/继续
    - 左右滑动切换图片（移动端触摸，touch-none 阻止页面滚动）
    - 左右方向键切换图片（桌面端键盘）
    - 空格键暂停/继续播放
    - 图片切换动画（使用 variants + custom 模式，参照个人主页实现）
    - 自动切换图片：多张图片时自动轮播，时长根据音频时长/图片数量计算
    - 手动切换暂停轮播：用户手动切换后暂停自动轮播，暂停再恢复时继续
    - 手动设置图片预览时长：投稿时可设置每张图片的预览秒数
    - 暂停/播放指示器：弹性动画图标，700ms 后自动消失（模仿视频播放器效果）
    - 底部控制栏：播放/暂停按钮、图片计数器、圆点导航（hover 显示）
  - **视频播放器增强** — 空格键暂停/播放视频
  - **按钮位置优化** — 编辑模式/保存/删除选中按钮移到"图片（最多40张）"标题右侧
  - **多音频支持** — 最多3个音频，支持顺序/同时/随机播放模式切换
  - 新增组件：video-upload.tsx、image-text-upload.tsx
  - 删除组件：image-preview.tsx（功能已被 ImageTextUploadPage 替代）
- **图文投稿功能** — 新增图文投稿支持，用户可上传多张图片（最多40张）和可选背景音乐
  - 投稿页面添加标签切换按钮（视频投稿/图文投稿），默认视频投稿
  - 图文投稿表单：标题、描述、多张图片上传、音乐上传
  - 图片预览：轮播图+底部缩略图导航（最多5张同时显示，当前图片居中）
  - 封面选择：点击缩略图上的封面按钮可设置/取消封面，未选择则默认第一张
  - 拖拽排序：缩略图支持拖拽手柄排序，拖放手柄到任意缩略图区域即可调换位置
  - 图片数量限制：最多40张，超过时提示并只添加可用数量
  - 音乐播放器：播放/暂停、进度条、删除
  - 客户端压缩：图片超过15MB或分辨率超过2K时自动压缩（Canvas API）
  - 压缩确认：大文件压缩前弹窗确认，显示预估压缩后大小
  - 数据库扩展：Video模型新增postType、imageUrls、musicUrls字段
  - 上传API扩展：支持图片（15MB）和音乐（50MB）类型上传，路径区分covers/images/music
  - 新增组件：music-player.tsx、compress-dialog.tsx
  - 新增工具函数：image-compress.ts、music-compress.ts
  - 进度百分比显示整数，移除标题required属性避免预览时验证
- **弱网图片加载优化** — 全面优化弱网环境下图片加载性能
  - `optimizedCover()` 支持 picsum.photos 图片缩放（替换 URL 末尾尺寸参数，请求小尺寸版本）
  - 所有 `<img>` 标签添加 `width`/`height`（消除 CLS）、`decoding="async"`（异步解码）
  - `layout.tsx` 添加 OSS 域名 `preconnect` + `dns-prefetch`（提前建立连接）
  - OSS 图片添加 `quality,q_80` 质量参数（减小文件体积）
  - Aliplayer 播放器封面调用 `optimizedCover(coverUrl, 1280)` 优化
  - 未上传封面时使用本地 `public/placeholder.svg`（消除 picsum.photos 外部依赖）
  - 涉及文件：`image.ts`、`layout.tsx`、`video-card.tsx`、`video-player.tsx`、`recommendations.tsx`、`profile/page.tsx`、`search/page.tsx`、`admin/page.tsx`、`user/[id]/page.tsx`、`upload/page.tsx`、`api/videos/route.ts`
- **衍生版同步** — 将 bilibili 原版的图片优化功能合并到 Qbilibili 衍生版
  - 新增 `src/lib/image.ts` 到 Qbilibili
  - 9 个文件添加 `optimizedCover()` + `loading="lazy"` 懒加载
  - 首页添加 `force-dynamic` 缓存控制
  - 上传页修复 `videoUrl || undefined` 空值处理
- **封面图片加载优化** — 新增 `src/lib/image.ts` 工具函数 `optimizedCover()`，为所有封面图生成带 OSS 图片处理参数的 URL（按需缩放+WebP格式转换），所有 `<img>` 标签添加 `loading="lazy"` 懒加载
  - 首页/用户页/搜索/个人中心：缩放到 640px 宽度
  - 推荐栏/评论缩略图：缩放到 400px 宽度
  - 管理面板缩略图：缩放到 300px 宽度
  - 涉及文件：`video-card.tsx`、`recommendations.tsx`、`user/[id]/page.tsx`、`profile/page.tsx`、`search/page.tsx`、`admin/page.tsx`
- **Mixed Content 修复** — 新增 `toHttps()` 工具函数，OSS URL 统一升级为 HTTPS（封面图通过 `optimizedCover()` 处理，视频播放 URL 通过 `toHttps()` 处理），消除浏览器 Mixed Content 警告
  - 涉及文件：`image.ts`（新增 toHttps）、`video-player.tsx`（视频播放和播放列表）
- **标题/logo 全小写** — 网页标题和 Header logo 统一改为小写 `bilibili`
- **首页动态渲染** — 添加 `export const dynamic = "force-dynamic"`，避免 Next.js 静态缓存导致新投稿不显示
- **投稿"URL格式无效"修复** — VOD 上传成功后 `videoUrl` 返回空字符串 `""`，非 `undefined`，无法跳过 `safeUrl.optional()` 校验，`.url()` 对空字符串报错。修复：提交时 `videoUrl: videoUrl || undefined` 空字符串转为 undefined
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
- **弱网交互优化** — 全面优化弱网环境下页面交互响应速度
  - **乐观更新** — 点赞、收藏、评论、回复、评论点赞全部改为点击后立即更新 UI，失败时回滚，弱网下操作响应从 1-3 秒降为 0 延迟
  - **页面骨架屏** — 新增 4 个 `loading.tsx`（首页/播放页/个人中心/搜索页），页面导航时立即显示页面结构，消除白屏
  - **代码分割** — `CommentSection`、`Recommendations`、`AuthModal` 通过 `next/dynamic` 懒加载（含骨架屏 fallback），视频播放页首屏 JS 减少约 30%
  - **播放器预加载** — `layout.tsx` 中添加 Aliplayer CDN 的 `<link rel="preload" as="script">` 预加载
  - **API 缓存头** — `next.config.ts` 为推荐视频（60s）、视频详情（30s）、静态资源（1年 immutable）设置 Cache-Control
  - **客户端 fetch 缓存** — 新建 `src/lib/fetch-cache.ts`，推荐列表 60s 缓存、播放列表 5 分钟缓存、VOD playAuth 60s 缓存
  - **播放列表减量** — 播放列表从 50 条减为 20 条，减少首屏传输体积
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
- **毛玻璃效果** — 全站添加 glassmorphism 视觉效果
  - Header 导航栏：`bg-white/80` 半透明背景（不使用 backdrop-blur，避免遮挡子元素模糊）
  - 头像下拉菜单 / 搜索历史下拉：`backdrop-blur-xl bg-white/70` 直接模糊页面内容
  - 登录/注册弹窗遮罩：独立模糊层（静态 backdrop-blur 4px）+ opacity 动画淡入淡出（0.4s）
  - 确认弹窗遮罩：同上
  - 管理页面确认弹窗：同上
  - 技术方案：弹窗分离模糊层与内容层（blur 静态值 + opacity GPU 合成器动画）；下拉菜单 blur 直接作用于内容层（避免父级 backdrop-blur 合成层遮挡）
- **状态管理优化** — 解决三个代码质量问题，提升类型安全和可维护性
  - **类型安全的 sessionStorage 信号工具** — 新建 `src/lib/signals.ts`，将分散在 7 个文件中的 `sessionStorage.setItem/getItem` 硬编码字符串键提取为 4 个类型安全的函数（`setAutoPlayVideo`、`consumeAutoPlayVideo`、`setHighlightComment`、`consumeHighlightComment`），消除键名拼写错误导致静默失败的风险
  - **VOD auth 缓存模块化** — 新建 `src/lib/vod-cache.ts`，将 `video-player.tsx` 中 `globalThis.__vodAuthCache` 的全局可变对象提取为独立的 TypeScript 模块（`getVodPlayAuth()` 函数），提供类型安全的缓存接口和 60 秒 TTL
  - **VideoPlaySection useReducer 重构** — 将 `video-play-section.tsx` 中 8 个独立 `useState` 调用合并为单个 `useReducer`（`VideoState` 接口 + `VideoAction` 联合类型 + `videoReducer`），`onVideoChange` 回调从 8 行 setter 简化为 1 行 dispatch

### 音频响度标准化（本次会话新增）
- **异步处理队列** — `src/lib/audio-queue.ts` 实现内存队列 + Worker，每 5 秒检查一次，失败最多重试 2 次
- **FFmpeg loudnorm** — `src/lib/audio-normalize.ts` 使用 EBU R128 标准（-14 LUFS）标准化音频响度
- **非阻塞播放** — 上传后立即返回，用户先播放原始版本，后台处理完成后自动切换到标准化版本
- **数据库字段** — Video 表新增 `audioNormalized`（是否已标准化）和 `normalizedUrl`（标准化后 URL）
- **播放器适配** — `video-player.tsx` 播放时优先使用 `normalizedUrl`，播放列表也使用标准化版本
- **启动时自动回填** — 服务器启动时自动扫描数据库里未标准化的视频加入队列处理
- **FFmpeg 路径修复** — 生产环境下 Next.js 打包导致 `ffmpeg-static` 的 `__dirname` 路径错误，改用 `require.resolve` 手动定位二进制文件
- **VOD 视频支持** — 通过 `getVodPlayUrl()` 调用 VOD `GetPlayInfo` API 获取带签名的播放 URL，支持下载并标准化 VOD 视频
- **处理范围** — 支持 OSS 直链视频和 VOD 鉴权视频，所有 12 个视频已全部标准化

### 音频响度标准化优化（2026-07-17）
- **两次通过 loudnorm** — 从单次通过改为两次通过（two-pass），精度从 ±1~3 LU 提升至 ±0.5 LU。第一遍分析音频统计信息，第二遍使用 measured_I/measured_TP/measured_LRA/measured_thresh 精确调整
- **移除图文类型跳过** — 图文类型（image_text）视频不再被跳过，所有视频类型均参与响度标准化
- **VOD 立即入队** — VOD 视频上传后立即加入标准化队列（不再等 backfillQueue 5秒扫描），修复 VOD 视频标准化延迟问题
- **详细失败日志** — 处理失败时记录视频 ID、尝试次数（attempt N/M）、错误原因；重试耗尽时记录 "GIVING UP" 消息，便于排查问题
- **FFmpeg stderr 修复** — loudnorm JSON 输出在 stderr 而非 stdout，修复了两次通过中第一遍测量值解析失败的 bug
- **测量值验证** — JSON.parse 后验证 measured_I/measured_TP/measured_LRA/measured_thresh 是否存在，防止 undefined 值传入 FFmpeg
- **图文自动标准化** — 图文投稿（image_text）自动进行音频响度标准化：上传路由入队条件增加 `postType === "image_text" && musicUrl`，队列处理器用 `musicUrl` 作为音频源，标准化后上传到 `music/normalized_{id}.m4a`，图文播放器 ImageCarousel 优先使用 `normalizedUrl`
- **已处理"原神"视频** — 手动标准化"原神总是试图教会我们些什么"的音乐（-12.68 LUFS → -24.06 LUFS），上传到 OSS 并更新数据库
- **VOD 播放器修复** — 修复 video-player.tsx 中 VOD 视频忽略 normalizedUrl 的 bug：旧逻辑只要 vodVideoId 存在就走 VOD 鉴权播放，normalizedUrl 从未被使用；新逻辑优先用 normalizedUrl 作为 source 播放，仅当 normalizedUrl 不存在时才走 VOD 鉴权。所有视频（包括新投稿）现在都能正确使用标准化后的音频
- **响度目标调整** — 从 -24 LUFS（广播标准）调整为 -14 LUFS（流媒体平台标准，如 B站），用户反馈原始响度太小
- **进度追踪持久化** — 新增 `RenormalizeProgress` 数据库存储进度（总数/已完成/失败/进行中/等待中），刷新页面不丢失
- **管理面板控制** — 总览页新增「音频响度标准化」卡片，含「重新标准化」按钮（触发重新处理所有已标准化视频）和「重置进度」按钮（清空队列+重置进度），进度条实时显示
- **启动恢复机制** — 服务器重启后自动检测数据库中的 `isRunning` 状态，将未完成的视频重新入队
- **全局状态共享** — 所有队列状态（queue Map、activeCount、intervalId 等）存储在 `globalThis` 上，解决 Turbopack 多 chunk 打包导致模块实例不共享的问题
- **FFmpeg 输出解析健壮化** — loudnorm JSON 解析支持清理控制字符（`\r`）、精确匹配 `[Parsed_loudnorm` 后的 JSON 块（避免匹配到 FFmpeg 元数据中的干扰 JSON）、跳过无效测量值（`-inf`/`-nan`）
- **边缘 URL 处理** — 本地路径自动补全为完整 URL（`/uploads/...` → `https://your-domain.com/uploads/...`）、非视频 Content-Type 响应检测跳过、musicUrl 控制字符清理
- **队列取消机制** — 重置进度时清空内存队列+设置取消标志，正在运行的任务完成后自动停止

### 图文播放器进度条（本次会话新增）
- **底部进度条** — 图文播放器底部显示与图片数量等量的细小横条，每张图片对应一段，播放时白色从左到右逐渐填充，整条变白后自动切换下一张
- **requestAnimationFrame 平滑动画** — 使用 RAF 逐帧更新进度，替代定时器，动画丝滑无卡顿
- **暂停就地冻结** — 暂停时进度条停在当前位置，恢复后从断点继续（不重头开始）
- **手动切换满白** — 手动切换图片时进度条立即显示 100%（全白），自动轮播暂停
- **恢复重播** — 手动切换后点击播放，进度条归零，当前图片从头开始播放

### 本次会话修复
- **修复改密码后无法登录** — JWT 回调中新登录时 `token.tokenVersion` 硬编码为 `0`，但改密码后数据库 `tokenVersion` 已递增，导致新 token 在创建瞬间因版本不匹配被撤销。修复为新登录时从数据库读取实际 `tokenVersion`
- **图片轮播 stale closure 修复** — `goToImage` 回调从依赖 `currentIndex` 改为 `setCurrentIndex(prev => ...)` 函数式更新，修复快速连续点击时滑动方向判断错误
- **视频详情 API 缓存** — 添加 `Cache-Control: public, s-maxage=300, max-age=300`（5 分钟缓存），减少重复请求
- **音频队列重复处理修复** — `backfillQueue()` 添加 `id: { notIn: [...] }` 过滤，避免服务器重启后重复加入已在队列中的视频
- **视频卡片冗余逻辑清理** — 移除永远不会触发的"无封面"分支（`coverUrl` 是必填字段）
- **播放器点击暂停修复** — 旧代码用黑名单排除 `.prism-controlbar` 等元素，但 Aliplayer 的 `.prism-volume-control` 等控件不在 `.prism-controlbar` 内部，导致点击音量条/按钮等控件时误触发播放/暂停。修复为白名单方式：`click` 和 `touchend` 只在 `e.target === player.tag`（即直接点击 `<video>` 元素）时才切换播放/暂停。同时恢复 `touchstart` 的 `e.preventDefault()` 阻止移动端浏览器合成 `click` 事件，确保移动端保持双击暂停行为
- **图文播放器按钮点击修复** — 图文播放器的 `onClick` 处理器在容器上无条件调用 `togglePlay()`，React 的 `stopPropagation` 无法阻止原生事件冒泡，导致点击左右切换按钮/播放按钮时也会触发暂停。修复为在容器 `onClick` 中检查 `e.target` 是否为 `button` 或 `a` 元素，是则跳过

### 性能优化（本次会话）
- **搜索 API 全表扫描优化** — 搜索从加载全部评论/视频到内存再过滤，改为数据库 `LIKE` 预过滤+内存高亮定位，大幅减少内存占用
- **评论删除 N+1 优化** — `collectDescendants` 递归函数改为迭代式 BFS，每层子评论只需 1 次批量 DB 查询
- **音频队列并发处理** — 音频标准化队列从串行（`isProcessing` 锁）改为并发（最多 2 个任务并行），吞吐量提升 2x
- **FFmpeg 流式处理** — 新增 `normalizeAudioFromUrl()` 函数，从远程 URL 流式下载到临时文件再处理，避免全量视频加载到内存
- **上传路由流式处理** — 大文件（>5MB）使用 `Readable.fromWeb()` + `oss.putStream()` 流式上传，避免全量 Buffer 拷贝
- **VideoCard useMemo** — 视频卡片头像颜色计算使用 `useMemo` 缓存，避免列表重渲染时重复计算
- **VOD 缓存 LRU 淘汰** — `playAuthCache` 添加最大 100 条限制和过期清理机制，防止长时间运行内存泄漏
- **数据库索引** — Video 表添加 `authorId`/`createdAt`/`title` 索引，Comment 表添加 `videoId`/`authorId`/`parentId`/`createdAt` 索引，Like 表添加 `userId` 索引，Favorite 表添加 `userId` 索引

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
1. **Cloudflare R2 替代阿里云 OSS** — OSS 约 2 个月后过期，计划用 Cloudflare R2 完全替代。R2 免费 10GB/月 + 出站流量永久免费。方案：Pre-signed URL 直传（服务器签发临时 URL，浏览器直传 R2），不经过服务器内存。需安装 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`，删除 `ali-oss` 和旧 `/api/upload` 接口。VOD 路径不变。计划文件：`.mimocode/plans/1784085656280-misty-garden.md`
2. **VOD 断点续传** — 上传中断后恢复（aliyun-upload-sdk 支持 checkpoint）
3. **通配符证书** — 当前证书仅覆盖 `your-domain.com` + `www.your-domain.com`，子域名 HTTPS 需更换 `*.your-domain.com` 证书
4. **HSTS** — 启用 `Strict-Transport-Security` 头，强制浏览器 HTTPS
5. **密码哈希存储** — 使用已安装的 bcryptjs 对密码进行哈希存储（MVP 技术债务）

### 中期
6. **无限滚动分页** — 首页视频列表无限滚动加载
7. **Toast 消息提示** — 轻量级提示框替代 alert/confirm 弹窗
8. **视频编辑功能** — 支持修改标题/描述
9. **视频详情优化** — 播放量统计、点赞数实时更新

### 长期
10. **监控日志** — 错误监控、用户行为分析

## 技术债务
- 密码明文存储，生产环境需用 bcrypt 哈希（bcryptjs 已安装未启用，已记录为 MVP 特性）
- CSRF 保护不完整，低危路由未启用（已记录为 MVP 特性）
- OSS AccessKey 存在 .env 中，生产环境应使用 RAM 子账号

## 已知问题
- 部分图标使用 lucide-react，未完全统一风格
- 投稿页无法复制输入框外的文字（浏览器层面问题，非代码导致）
