# Bilibili MVP 进度文档

## 当前状态：原版功能合并已完成

开发服务器：http://localhost:3005

## 已完成工作

### 本次会话（描述折叠 + 投稿页布局调整）
- **内容描述折叠功能（CollapsibleDescription）** — 视频播放页描述（视频/图文类型共用，video-play-section.tsx）
  - 判断规则：内容超过 1.5 行（超过 2 行，或第 2 行内容超过半行宽）时折叠
  - 折叠显示：第一行完整 + 第二行文字按**字符量水平截断**（不是固定 max-height 垂直腰斩），截断点后同一行接上 "···" + "展开" 按钮；展开后全文显示，文本末尾内联"折叠"按钮
  - 测量方案：隐藏测量节点（同宽同字体同换行规则）+ `Range.getClientRects()` 逐行取实际像素宽度（不能用 scrollHeight——第二行只要有内容高度就整行 +1，无法表达"1.5 行"），二分查找使"第二行内容 ≤ 半行宽 + 后缀（···展开，实测按钮宽度预留）不溢出"的最长前缀
  - 踩坑修复：Range 必须 `setStart(tn, 0)` + `setEnd`（只 setEnd 时 range 起点指向整篇文档，getClientRects 返回页面所有元素垃圾矩形）；过滤行尾 0 宽插入点矩形（width > 0.5）；相对宽度比较不能用绝对坐标（left:-9999 离屏定位时 right 为负值，`used <= right` 恒不成立导致截断归零——本体"连第一行都没有"的根因）
  - 细节：前缀末尾 `\n` 去除后再拼接后缀（避免残留换行多占空行把截断点压回第一行）；截断点落在符号（\p{P}\p{S}）上向前推移一个字符；窗口 resize 重新测量；切视频按 `key={videoId}` 重置折叠状态
- **视频投稿页字段顺序调整** — 右侧表单顺序由「视频文件→标题→简介→封面图」调整为「标题→简介→视频文件→封面图」，与图文投稿一致（video-upload.tsx）
- **投稿页预览窗口与表单等高对齐** — 视频/图文投稿左侧预览窗口高度与右侧表单列对齐：外层去掉 `lg:items-end` 动态条件（恢复默认 stretch 等高），左侧 sticky 容器 `lg:h-full`，预览框 `lg:aspect-auto lg:flex-1` 填满剩余高度（移动端仍保持 aspect-[3/4]）；封面预览块保持预览框下方（video-upload.tsx / image-text-upload.tsx）

### 本次会话（评论图片预览 PC 5 列 + 灯箱鼠标双击缩放）
- **评论图片预览网格 PC 端 5 列** — comment-images.tsx 移动端保持 3 列，PC（sm+ 断点）改为 5 列（`sm:max-w-[750px] sm:grid-cols-5 sm:gap-1.5`）；溢出小标移动端第 3 格、PC 端第 5 格显示 `+N`（黑底白字，`+溢出数`）；可见性规则升级：`i >= 5` 全部隐藏、`i >= 3` 移动端隐藏 PC（sm:block）显示，改用变量 `PC_MAX_VISIBLE = 5`
  - 部署坑：本轮为纯 CSS 类改动，编译产物此前未包含该类是线上不生效的根因——生产更新必须 `npm run build` 重新构建，不能只重启服务
- **灯箱鼠标双击缩放改原生 dblclick** — image-lightbox.tsx 鼠标分支改为 `container.addEventListener("dblclick")` 原生监听（浏览器按平台阈值判定最可靠），双击图片在 250% 与 100% 之间切换（未缩放→放大 250%，已缩放→复原），与触摸双击行为一致；触摸分支保持 handleTap 状态机不变（原鼠标复用触摸 touchend 状态机的 pointerup 分支可靠性差）
- **防双触发 lastTouchTimeRef** — 新增 ref 记录最近触摸时间，dblclick 触发时若 800ms 内有触摸则忽略（移动端浏览器会为快速两次触摸合成 dblclick，避免与 touchend 判定重复 toggle）
- **单击图片误关灯箱修复** — 新增 `pointerOnImageRef`：pointerdown 记录按下点是否在图片上，容器 onClick 用它拦截——根因是 `setPointerCapture` 会把随后的 click 事件重定向到容器元素，绕过 page div 的 stopPropagation，单击图片直接 close()

### 本次会话（评论图片灯箱升级 + 预览网格移动端自适应）
- **灯箱相册式滑动切换** — 评论图片灯箱与图文播放器一致的三页轨道布局（前后相邻页并排常驻、头尾循环），移动端单指滑动/桌面端鼠标拖拽实时跟手，松手超过 1/4 页宽滑入相邻页否则回弹（image-lightbox.tsx）
- **灯箱缩放重构（关键修复）** — pinch 缩放改为增量式累加（每帧位移 ×0.01），连续跟手无跳档；缩放不与 DOM 结构绑定（display 恒为三页轨道，缩放只改交互语义：拖动 = 平移），避免 pinch 跨过 1±0.05 阈值时 DOM 重建导致的闪顿/缩放中断；新增 setScaleSync 统一同步 scaleRef 与 state，手势判定永远读最新值（原 useEffect 滞后会读到陈旧值）
- **双击缩放检测状态机（关键修复）** — 双击唯一入口 = 原生 touchend/pointerup 的 handleTap 状态机，彻底移除 React onDoubleClick（移动端浏览器会合成 dblclick 事件，与原生判定双触发导致 toggle 两次：双击太快变 250% 而非 100% 的 bug）；单击设 300ms pending 超时作废（单击永不触发缩放），双击后 350ms busy 冷却过滤双击后连击误判
- **移动端系统返回键关闭灯箱** — 打开时 pushState 压入标记，popstate 关闭灯箱并重新压入标记，系统返回不再退回上一页
- **缩放下限 0.5 倍** — 支持缩小至 0.5 倍查看，缩放指示器/计数器 z-index 修复不被遮挡
- **评论图片预览 grid 移动端自适应** — comment-images.tsx 多图缩略图网格改为 3 列 + 1:1 正方形（`max-w-[450px]`，移动端也等宽自适应），替代原 flex-wrap 固定 145px 尺寸

### 本次会话（图文播放器 2 张图 key 冲突修复）
- **图文播放器双图切换显示同一张修复** — 修复「01/02 两张图播放时显示成同一张、02 该暗却亮」问题
  - 根因：ImageCarousel 相册式三页轨道 `[prevIdx, currentIndex, nextIdx].map()` 以**图片序号**做 React `key`（`key={page-${idx}}`）。只有 2 张图时 `prevIdx === nextIdx`，导致 `page-0/page-1` 出现重复 key，React DOM 复用错乱：切换后计数器跳对但**主图 src 不更新**（仍显示上一张）、上下页元素意外残留（DOM 出现第 4 页）。3+ 张图时各图序号不同，正常；仅 2 张边界触发
  - 修复：key 改为**槽位号** `key={page-slot-${slot}}`（slot=0/1/2 恒唯一），DOM 结构稳定，React 仅更新各槽位 `src`，双图切换恢复正常（video-play-section.tsx）
  - 排查过程：OSS/数据库/ICC 色彩配置均排除（已用 SHA-256、ffmpeg signalstats、PIL ICC 应用对比逐层验证 01/02 字节与亮度正确、ICC 应用前后亮度不变），最终用 Playwright 无头浏览器逐帧采样亮度曲线复现「先暗后亮」并定位为 key 冲突，而非图片/ICC/缓存问题

### 本次会话（评论粘贴净化）
- **评论粘贴净化** — 修复从其他网页复制文字粘贴到评论区时带入源页面样式/HTML 标签的问题
  - 根因：评论区输入框是 `contentEditable`，浏览器默认粘贴会插入剪贴板里的 `text/html`（含源页面 `style="color:..."` 等内联样式与任意 HTML 标签）。从 A 网页复制红色文字粘贴到评论区，文字变红、控制台能看到 color 属性；记事本只读 `text/plain` 所以看不到标签
  - 修复：`handlePaste`/`handleReplyPaste` 在剪贴板无图片、无图片 URL 时 `preventDefault()` 拦截默认粘贴，只取 `text/plain` 纯文本用 `document.execCommand("insertText")` 插入，丢弃所有 HTML 标签与内联样式；图片/GIF/图片 URL 粘贴不受影响
  - 效果：复制文字进评论区变为纯文本，颜色/字体/标签全部消失，恶意 HTML 标签无法注入页面；提交仍只存 `textContent` 纯文本，发布内容始终安全

### 本次会话（视频投稿修复）
- **视频投稿按钮无响应修复** — 修复点击「立即投稿」无反应问题
  - 根因：`VideoUploadPage` 的提交回调使用 `document.querySelector("form")` 拿到的是 DOM 中第一个 `<form>`，即 Header 顶部搜索框（Header 渲染在投稿页之前），`requestSubmit()` 触发的是搜索表单而非投稿表单 → 看起来"没反应"
  - 修复：视频投稿改为与图文投稿一致，直接调用 `handleSubmit`（upload/page.tsx）
- **VOD 上传进度百分比异常修复** — 修复显示 `1917338%` 的荒谬百分比
  - 根因：`aliyun-upload-sdk` 的 `onUploadProgress` 回调签名是 `(fileInfo, totalBytes, loadedBytes)`，原代码把第二个参数（总字节数，如 1917338 字节）当成百分比直接显示
  - 修复：按 `loaded / total * 100` 计算真实百分比，并 `Math.min(100, ...)` 封顶（upload/page.tsx）

### 本次会话（图文控件裁切 / 音量 1.5s / 评论图片 1:1）
- **图文播放器控件裁切修复** — 修复音量条/模式提示超出控制栏被裁切显示不全
  - 根因：控制栏 0fr↔1fr 水托荷叶动画依赖内层 `overflow-hidden` 裁切，向上弹出的音量条、模式提示弹层也被一起裁掉
  - 修复：弹层移出 `overflow-hidden` 裁切层，作为控制栏兄弟节点渲染；用 `useLayoutEffect` 测量按钮相对播放器容器的实际位置（`getBoundingClientRect` 差值）做绝对定位，弹层显示/容器尺寸变化时自动重算，全屏/缩放不错位
- **音量条 2s → 1.5s 自动消失** — 悬停音量图标弹出的音量条自动隐藏时间由 2s 缩短为 1.5s（`video-play-section.tsx` `showVolumeTemporarily`）
- **评论图片展示优化** — `comment-images.tsx` 单图等比缩小显示，多图改为每张 1:1 方形裁切（桌面端 145px / 移动端 112px），GIF 完整显示不裁切

### 本次会话（键盘控制 / 图文相册 / GIF 评论 / 主题遮罩 / 头像统一）
- **键盘控制增强** — 新增 `src/lib/keyboard.ts`（`isEditableTarget` + `isComposingEvent`）
  - 评论/搜索输入时方向键不再误触图文/视频控制（contentEditable 聚焦或中文输入法组合中自动跳过）
  - 视频播放器：方向键由「切换上/下一个视频」改为「快退 5 秒 / 快进 5 秒」，新增 A/D 键同效（控制栏原生上一个/下一个按钮保留）
  - 图文播放器：左右切换新增 A/D 键
- **图文相册式左右平移** — 重构 ImageCarousel 切换机制
  - 横向轨道布局：当前页 + 前后相邻页（循环）三页并排常驻，切换不再反复挂载/卸载，消除黑屏闪烁
  - 鼠标左键按住拖动实时跟手平移（PC + 移动端 Pointer 事件统一），能看到当前页后半 + 相邻页前半并排
  - 松手超过 1/4 页宽滑入相邻页（头尾循环），否则回弹；无位移的点击仍正常播放/暂停
  - 进度条/左右按钮/方向键/A-D/自动轮播统一走同一滑动动画
  - 每页独立高斯模糊背景随图一起平移，`overflow-hidden` 裁剪避免相邻页模糊串色
  - 预加载窗口：预览当前图时提前加载前后各 2 张（共 4 张）图片；实况视频数据预加载（隐藏 video 缓冲、不播放、仍显示封面），切到实况时立即就绪
  - 自动轮播与手动切换分离：自动推进不暂停、进度从 0 续播；手动切换（按键/拖拽/按钮/进度条）暂停并满进度显示
- **评论 GIF 粘贴上传** — 修复粘贴 GIF 无法发送
  - 原根因：`handlePaste` 定义了但未绑定 `onPaste`，浏览器把 `<img>` 直接插入 contentEditable 而 `hasContent()` 只查文本 → 发送键禁用
  - 绑定 `onPaste`：拦截图片文件（含 GIF）转预览图；兼容粘贴图片 URL（HTML `<img>` / uri-list / 纯文本链接自动下载）
  - `hasContent()`/`canReply()` 识别嵌入 `<img>`；提交时兜底收集嵌入图片上传
  - GIF 不走 canvas 压缩（会破坏动画），超 8MB 提示更换；其他格式保持压缩
- **评论图片展示优化** — `comment-images.tsx` 展示规则调整为：单图等比缩小显示（object-contain），多图每张 1:1 方形裁切缩略图（桌面端 145px / 移动端 112px），GIF 动图完整显示不裁切
- **评论输入框增高** — 主评论框 min-height 40px→66px（2.5 行），回复框 32px→62px，可看到下一行文字
- **头像颜色统一** — 新增 `src/lib/avatar.ts`（`avatarColorFor()` 共享 hash 算法 + 色板）
  - 替换所有硬编码粉色头像：评论区（评论/回复）、视频作者位置、管理面板用户列表、个人中心、公共主页、头像菜单、视频卡片
  - 同一用户名在所有位置颜色一致
- **相关推荐作者头像** — `recommendations.tsx` 作者名前增加 20px 圆形头像，`items-start` 顶部对齐
- **深浅模式圆形遮罩扩散动画** — 重构 `theme-provider.tsx`
  - 点击切换按钮时从按钮位置生成纯色圆（#fff/#09090b），恒定速度向四周扩散覆盖全屏
  - 圆放 `z-index:-1` 背景层，只遮 body 背景所在的空白/骨架区域，卡片/按钮/视频/文字不被遮挡
  - 圆中圆：扩散中途再点切换，生成相反颜色圆叠在上面同速扩散，最上层定最终色；`.dark` 只按最上层切换一次
  - 背景扩散完成后给文字/UI 加 `theme-text-fade` 渐变（0.35s），多次切换只以最后一次颜色为准
  - 移除旧 `.dark-transition` 整页渐变及其死代码 CSS
- **移动端进度条常驻 + 控制栏水托荷叶** — 重构图文控制栏布局
  - 进度条从控制栏独立出来，始终显示在屏幕底部
  - 控制栏用 grid 行高 0fr↔1fr 动画：隐藏时高度 0 落底，显示时从底部向上生长升起（桌面 group-hover / 移动端单击），隐藏时反向落下
  - 控制栏升起把进度条托上去，落下时进度条落回底部，无重复进度条

### 基础框架
- Next.js 16 + TypeScript 项目搭建
- Tailwind CSS v4 配置
- Prisma ORM + SQLite 数据库
- NextAuth.js v5 用户认证

### 页面功能
- **首页** — 视频卡片网格布局（响应式 2/3/4/5 列）
- **视频播放页** — 视频播放、点赞、收藏、评论、删除（仅作者）、编辑（仅作者）、播放模式切换
- **视频编辑页** — 编辑视频标题、描述、封面；图文类型支持修改图片顺序、轮播时长（自动/手动1-30秒）、从现有图片选择封面、上传新封面
- **上传页** — 真实文件上传到阿里云 OSS（视频+封面），支持粘贴/拖拽、文件预览、上传进度条
- **个人主页** — 账号设置、我的投稿（可删除/编辑）、收藏列表、点赞列表（含视频/评论/获赞三个子分类，左侧竖向菜单切换）、我的评论（含删除）
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
- **视频播放器** — 暂停遮罩、播放模式切换（循环/单次/自动连播）、模式按用户永久保存到数据库
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
- **Emoji 支持功能** — 评论/投稿支持 Unicode emoji 和抖音表情包
  - 选择器面板：emoji-picker.tsx 组件，分类浏览 + 搜索过滤，点击插入到评论框
  - B站格式兼容：`:表情名:` 语法自动解析为 emoji 图片
  - ContentEditable 实时预览：评论框使用 contentEditable 实现 emoji 图片实时渲染
  - 抖音表情包：214 个表情，图片存储在 public/emoji/douyin/，数据定义在 douyin-emoji-data.ts
  - Unicode emoji 数据：emoji-data.ts 按类别组织的完整 emoji 列表
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

### 播放模式用户偏好设置（本次会话新增）
- **数据库持久化** — User 表新增 `playMode` 字段（默认 "loop"），播放模式按用户永久保存
- **API 路由** — 新建 `/api/user/play-mode`（GET/PUT），读写用户播放模式偏好
- **共享模块** — 新建 `src/lib/play-mode.ts`，导出 `PlayMode` 类型、`MODES` 常量、`fetchPlayMode()` 和 `updatePlayMode()`，视频和图文播放器共用
- **视频播放器** — 移除本地 localStorage 逻辑，改用共享模块（从 API 获取 + API 更新 + localStorage 降级）
- **图文播放器** — ImageCarousel 新增播放模式支持：
  - `loop`：所有图片播完后回到第 1 张继续（默认行为）
  - `single`：所有图片播完后停止在最后一张
  - `next`：所有图片播完后跳转下一个视频
  - 右上角模式切换按钮（Repeat/Play/SkipForward 图标 + tooltip）
- **VideoPlaySection** — 新增 `playMode` prop，服务端从数据库读取传入，图文播放器通过 `onNext` 回调跳转下一个视频
- **视频播放页** — 服务端 Promise.all 中新增查询 User.playMode，传给 VideoPlaySection
- **未登录兼容** — API 返回 401 时前端 fallback 到 localStorage/sessionStorage（保持现有体验）

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
- **移动端进度条修复** — 修复移动端图文播放器进度条不显示的问题：原控制栏使用 `opacity-0 group-hover:opacity-100`，移动端没有 hover 事件导致永远隐藏；现在移动端通过单击切换控制栏显示/隐藏，默认进入播放页显示3秒后自动隐藏
- **移动端隐藏导航按钮** — 移动端隐藏左右切换按钮（`hidden sm:block`），用户通过左右滑动切换图片，提升移动端浏览体验

### 本次会话修复
- **图文播放器单音频循环播放声音丢失** — 当只有一个音频时，`handleAudioEnded` 调用 `setCurrentAudioIndex(0)` 不改变状态（本来就是 0），useEffect 不触发导致音频不重播。修复为单音频时直接调用 `audioRef.current.currentTime = 0` + `play()` 强制重启
- **Next.js 版本升级** — 从 16.2.9 升级到 16.2.12
- **构建内存限制** — `package.json` build 脚本添加 `NODE_OPTIONS="--max-old-space-size=1536"`，防止 3.6GB 小内存机器构建时 Swap 卡死 CPU 100%
- **修复改密码后无法登录** — JWT 回调中新登录时 `token.tokenVersion` 硬编码为 `0`，但改密码后数据库 `tokenVersion` 已递增，导致新 token 在创建瞬间因版本不匹配被撤销。修复为新登录时从数据库读取实际 `tokenVersion`
- **图片轮播 stale closure 修复** — `goToImage` 回调从依赖 `currentIndex` 改为 `setCurrentIndex(prev => ...)` 函数式更新，修复快速连续点击时滑动方向判断错误
- **视频详情 API 缓存** — 添加 `Cache-Control: public, s-maxage=300, max-age=300`（5 分钟缓存），减少重复请求
- **音频队列重复处理修复** — `backfillQueue()` 添加 `id: { notIn: [...] }` 过滤，避免服务器重启后重复加入已在队列中的视频
- **视频卡片冗余逻辑清理** — 移除永远不会触发的"无封面"分支（`coverUrl` 是必填字段）
- **播放器点击暂停修复** — 旧代码用黑名单排除 `.prism-controlbar` 等元素，但 Aliplayer 的 `.prism-volume-control` 等控件不在 `.prism-controlbar` 内部，导致点击音量条/按钮等控件时误触发播放/暂停。修复为白名单方式：`click` 和 `touchend` 只在 `e.target === player.tag`（即直接点击 `<video>` 元素）时才切换播放/暂停。同时恢复 `touchstart` 的 `e.preventDefault()` 阻止移动端浏览器合成 `click` 事件，确保移动端保持双击暂停行为
- **图文播放器按钮点击修复** — 图文播放器的 `onClick` 处理器在容器上无条件调用 `togglePlay()`，React 的 `stopPropagation` 无法阻止原生事件冒泡，导致点击左右切换按钮/播放按钮时也会触发暂停。修复为在容器 `onClick` 中检查 `e.target` 是否为 `button` 或 `a` 元素，是则跳过

### 实况照片（Live Photo）支持（本次会话新增）
- **需求** — 图文投稿支持实况照片，播放时像抖音一样自动静音播放实况视频，播完继续轮播；背景音乐保持正常播放（仅视频静音）
- **库选型调研** — 评估 `live-photo`（完整查看器）与 `motion-photo`（无头解析库）：最终发布端用 `motion-photo` 解析、`heic-normalize` 转码、`jszip` 解包；播放端自研原生 `<video>` 覆盖层（live-photo 查看器的悬停/长按交互不符合"轮播自动播放"需求）
- **多格式解析**（`src/lib/live-photo.ts`）：
  - Android Motion Photo：单文件 JPEG 内嵌 MP4，用 `motion-photo` 的 `MotionPhotoParser` 解析（XMP 元数据 + ftyp 回退）
  - Apple .livp 压缩包：`jszip` 解包提取图片+视频
  - Apple 分离格式（HEIC + MOV）：`heic-normalize` 将 HEIC 转 JPEG（Safari 原生解码 + WASM 兜底），按文件名自动配对（`IMG_1234.HEIC` + `IMG_1234.MOV`），选择顺序无关
  - `needsLivePhotoProcessing()` 预检测避免无谓处理，普通图片仍走原压缩路径
- **数据模型** — Video 表新增 `livePhotoVideos` 字段（JSON 数组，与 imageUrls 一一对应，`""` 表示静态图），向后兼容
- **上传链路** — 上传页检测到实况时自动解析配对，实况视频段以 `video` 类型上传 OSS，`livePhotoVideos` 与 `imageUrls` 同序提交；上传进度分配调整（图片70% + 实况视频10% + 音乐15% + 保存5%）
- **播放** — 轮播到实况图自动静音播放视频：
  - 进度条对应一节显示视频实时进度（timeupdate 驱动，非倒计时）
  - 视频完整播完（不随轮播倒计时）后自动切下一张，融入轮播节奏
  - 暂停/恢复时视频与音频同步控制
  - 支持循环/单次/自动连播模式
- **时长分配** — 自动模式下静态图时长 = `(总音频时长 - 实况视频总时长) / 静态图数`（最小保底2秒），实况图 = 视频完整时长，避免有的长有的短
- **封面** — 实况只能用静态帧（图片本身）做封面，不提供动图封面
- **编辑** — 编辑页加载/排序/删除/保存时 `livePhotoVideos` 与 `imageUrls` 同步
- **删除清理** — 删除视频时同步清理 OSS 中的实况视频文件
- **tsconfig 修复** — `Qbilibili` 目录（独立旧备份仓库）被 `**/*.tsx` 误扫导致类型错误，加入 tsconfig exclude

### 高斯模糊背景填充黑边（本次会话新增）
- **视频播放器** — 使用封面图（不随内容变化）作模糊背景叠加在视频下方；判断逻辑比较「视频实际比例」与「容器实际比例」（ResizeObserver + 轮询，元数据未就绪回退封面比例），差异超 5% 才启用，自动适配移动端/PC端任意容器比例
- **图文播放器** — 背景随当前图片动态变化，每张图 onLoad 记录真实比例与容器比较；`AnimatePresence` 让背景随内容一起交叉淡化切换（非原地突变），模糊参数 `blur-60px scale-110 opacity-80 brightness-0.5 saturate-1.25`
- **比例判断** — 不依赖固定 16:9 阈值，基于媒体实际比例与容器实际比例的差值，自适应竖屏/横屏/全屏

### 播放模式与音频修复（本次会话修复）
- **未登录播放模式持久化修复** — `play-mode.ts` 未登录用户从 `sessionStorage` 改为 `localStorage`，刷新页面不再丢失设置
- **单次播放音乐不停修复** — 单次模式播到最后一图只停止轮播未暂停音频，新增 `isPlaying → false` 时自动 `audio.pause()` 的 effect
- **单次播放后恢复从头开始** — 新增 `stoppedBySingleModeRef` 标记，单次播放暂停后点击继续时，图文从头开始、音乐接续
- **motion-dom 损坏文件修复** — `interpolate.mjs` 为 0 字节导致构建失败，重装 `motion-dom@12.40.0` 恢复

### 实况照片播放增强 + 上传预览（本次会话）
- **图文投稿上传实况视频预览** — 支持在图文投稿中直接选择 ≤4 秒的短视频作为实况照片：
  - `readVideoDuration()` 读取视频时长（`live-photo.ts`），`extractVideoCover()` 提取首帧作封面
  - 视频时长校验：≤4s 作为实况加入；>4s 弹窗提示（「前往视频投稿」/「确定」），确认后自动切到视频投稿 tab 并预填视频
  - `LivePhotoPreview` 组件：大预览/缩略图显示封面帧 + 播放按钮，点击后静音播放实况（播完自动暂停停在末帧）
  - 上传提示文案说明支持 ≤4 秒短视频作为实况
- **实况视频与图片配对增强** — `matchLiveVideo()` 支持同名 + 相似名配对：
  - 同名：`IMG_1234.MOV` + `IMG_1234.HEIC` 自动合并为实况项
  - 相似名：`1.jpg` + `1_实况.mp4`（或 `_live`/`live`/`_mov`/`mov`，支持 `1_实况2` 带序号变体）也合并
  - 防误配：剥离后缀后必须与图片基名完全相等，`11.mp4` 不会误配到 `1.jpg`
  - 未配对视频自动提取封面帧作为独立实况项（不再静默丢弃）
  - 配对视频时长超限时忽略视频仅保留静态图并提示
- **图文投稿预览丢失修复** — 移除 `ImageTextUploadPage` 卸载时 `URL.revokeObjectURL(preview)`，修复切换「视频投稿/图文投稿」标签后图文预览丢失问题（preview URL 由父组件持有，页面整体卸载时浏览器自动释放）
- **实况照片播放阶段机** — 遇到实况：预览 1s 封面帧 → 封面淡出+实况淡入 → 实况完整播放 → 实况淡出+封面淡入 → 再预览 1s → 循环轮播
  - 阶段机：`static-preview → live-fade-in → live-fade-out → static-preview`，用链式定时器 + epoch 守卫推进
  - 单图实况 loop 循环重播：`liveRestartTick` 信号（currentIndex 不变时 React 不重渲染，用独立计数器触发重跑）
  - 实况结束用 React 原生 `onEnded={handleLiveEnded}`（避免 effect addEventListener 绑定时机竞态导致不触发）
  - 视频仅在 fade 阶段挂载（`liveFadeVisible`），避免 GPU 合成层遮挡封面
  - **已解决**：半透明重叠交叉淡化已实现（见下方「实况半透明重叠交叉淡化」）

### 实况半透明重叠交叉淡化（本次会话新增，已解决）
- **需求** — 实况图播放流程：预览 1s 封面帧 → 封面/实况 0.8s 半透明重叠交叉淡化 → 实况完整播放 → 实况/封面 0.8s 交叉淡化 → 预览 1s → 循环。关键：过渡时两幅画面**同时在画面中、均半透明、像素级互相混合**
- **踩坑过程（记录供参考）**：
  - 最初用「层叠反转」：封面 `<img>` 在顶层（`will-change: transform` + `backface-visibility: hidden` 强制独立合成层）opacity 1↔0 淡出淡入、视频在底层。实测 Edge 下**即使封面 computed opacity=0，独立合成层仍遮挡下方 canvas**，导致实况看不到、只剩模糊背景
  - 改用「双元素 opacity 交叉淡化」：canvas 镜像视频 + 封面 `<img>` 同时过渡。仍失败——但控制台诊断（`elementFromPoint`、`getComputedStyle`）发现关键线索：canvas 用 `relative z-10` 时不可见，改用 `absolute inset-0` 后立即可见 → **真正根因是布局（文档流）问题：`relative` 元素不脱离文档流，canvas 被挤到容器下方（y=441 之外），被外层 `overflow-hidden` 裁掉**，与合成层无关
  - **根因结论**：之前所有"GPU 合成层遮挡"判断被带偏，实际是定位方式错误（应为 `absolute`）
- **最终方案（单 canvas 像素级混合）**：
  - 真 `<video>` `opacity:0` + `absolute inset-0` 隐藏，仅作 canvas 帧源（继续硬件解码、驱动 `onEnded`/进度条/首帧读取）
  - 新增 `<canvas>` `absolute inset-0`，`requestAnimationFrame` 逐帧 `drawImage` 镜像视频帧；同一画布里用 `globalAlpha` 同时绘制「封面帧（`1-fade`）+ 实况帧（`fade`）」，实现真正的像素级半透明交叉淡化，**不依赖任何元素层叠关系**
  - 封面帧用 `Image`（与 DOM 封面 img 同 URL，走浏览器缓存），`drawImage` 按 `object-contain` 等比缩放居中（`Math.min`），避免裁切
  - 封面 `<img>` 常驻渲染并置于 canvas 下方（`z-11` < canvas `z-12`），作为 canvas 首帧绘制前的无缝底衬（消除淡入空档闪烁；后续「实况交叉淡化完善」小节详述）
  - 首帧就绪（`loadeddata`）后再开始 0→1 淡入，避免淡入时 canvas 为空；1.5s 兜底强制淡入防卡死
  - 淡入淡出动画在 canvas 内用 `easeInOutQuad` 缓动推进（`liveFadeRef` + `fadeAnimRef`），`onEnded` 时反向淡化回封面
  - 淡入/淡出/预览/循环阶段机、`liveRestartTick` 单图循环、进度条驱动逻辑全部保留
- **SSR 播放页实况数据修复** — `video/[id]/page.tsx` 传给 VideoPlaySection 的对象补上 `livePhotoVideos` / `musicUrls` 字段（此前遗漏导致首屏进入实况不播放，切换视频后才正常）
- **Mixed Content 修复** — ImageCarousel 的图片/实况视频/音频 URL 统一用 `toHttps()` 转 HTTPS，消除 HTTPS 页面加载 HTTP 资源的拦截

### 实况交叉淡化完善（本次会话）
- **封面→实况闪烁消除** — 封面 `<img>` 从「实况阶段卸载」改为常驻渲染并置于 canvas 下方（`z-11` < canvas `z-12`）。canvas 首帧未画出的瞬间由封面 img 作无缝底衬，消除「封面消失 → canvas 空档」的闪烁
- **暂停保留进度原地暂停** — 实况播放中暂停不再跳回封面：阶段机暂停分支改为 `video.pause()` 原地冻结画面与进度；恢复时从当前位置直接续播；若恰好在播完淡出时刻暂停则重新淡入从头播
- **播放自动触发加 isPlaying 守卫** — 独立播放 effect 加 `isPlaying` 依赖，防止预览淡入窗口内暂停时视频仍自动播放
- **元数据/进度监听独立拆分** — 从阶段机拆出独立 effect 驱动 `loadedmetadata`/`timeupdate`（进度条与时长分配），暂停/恢复后依然生效

### 音量条自动隐藏 + 音量持久化（本次会话）
- **音量条 1.5 秒自动隐藏** — 悬停音量图标弹出音量条并启动 1.5s 定时器（鼠标不滑入则自动消失）；滑入滑块取消定时器保持显示（拖动中不中断），移出滑块立即隐藏；控制栏 group-hover 隐藏仍生效
- **音量状态持久化（仿播放模式）** — User 表新增 `volume`/`muted` 字段；新增 `src/lib/volume.ts`（`getSavedVolume`/`fetchVolume`/`updateVolume`，登录用户存数据库、未登录 fallback localStorage/sessionStorage）+ `/api/user/volume` GET/PUT；ImageCarousel 挂载时从数据库恢复音量/静音，调节/静音时保存；滑块拖动 300ms 防抖避免拖拽时刷请求
- **视频播放器音量与图文共享** — VideoPlayer 接入共享音量状态（`src/lib/volume.ts` + `/api/user/volume`）：播放器初始化时用 `fetchVolume` 读取并 `player.setVolume()`/`tag.muted` 应用；监听 `volumechange`/`volumnchanged` 事件，用户调音量/静音时 `updateVolume` 写回数据库；静音时保留此前音量（Aliplayer 静音会把音量清零，避免覆盖用户设定）；登录用户按用户存库、未登录 fallback 本地存储，图文/视频互相跟随

### 深色模式按用户持久化（本次会话）
- **User 表新增 `theme` 字段**（light/dark/system，默认 system）
- **新增 `src/lib/theme.ts`** — `getSavedTheme`/`fetchTheme`/`updateTheme`，localStorage 键沿用 `theme`（防白闪脚本零改动）
- **新增 `/api/user/theme` GET/PUT 路由**（含 CSRF 校验）
- **ThemeProvider 接入 Session** — 从 `SessionProvider` 外层移入内层，`useSession()` 拿 userId：登录用户主题存数据库（跨设备/刷新恢复），未登录 fallback localStorage；登录后异步覆盖本地值，保证即时渲染与防白闪一致

### 模糊背景纯黑修复（本次会话）
- **根因** — 图文模糊背景 `<img>` 带 `loading="lazy"`，挂在动态挂载、初始透明（opacity:0）的 `AnimatePresence` 层里，浏览器懒加载 IntersectionObserver 判断不可靠 → 背景图不加载 → 露出底下 `bg-black`（纯黑）；与封面同一 URL，封面能加载证明非限流/网络问题
- **修复** — 移除模糊背景 img 的 `loading="lazy"`（与封面一致的 eager 加载，同一 URL 已在缓存无额外开销）

### 输入框适配 + 输入长度限制（本次会话）
- **输入框滚动条适配深色模式** — `globals.css` 为所有 `textarea` / `input` / `[contenteditable="true"]` 添加统一滚动条样式（滑块 `#d4d4d8`/`#52525b`，轨道 `#f4f4f5`/`#27272a`），覆盖评论区、标题、简介、搜索框等
- **用户名最多 14 字符** — `validation.ts` `usernameSchema` 加 `.max(14)`，`loginSchema` 同步；登录/注册弹窗、独立登录/注册页、个人中心账号设置输入框加 `maxLength={14}`
- **密码最多 18 字符** — `validation.ts` `passwordSchema` 加 `.max(18)`，`loginSchema` 同步；各密码输入框（含注销确认密码）加 `maxLength={18}`
- **描述/简介最多 1000 字符** — `validation.ts` `videoSchema`/`videoUpdateSchema` description 上限从 2000 改为 1000；图文描述、视频简介、编辑页描述输入框加 `maxLength={1000}` + 计数显示

### 图文播放器交互增强（本次会话）
- **高斯模糊背景调亮** — 视频背景 `brightness(0.5)→0.9, opacity 0.85→1`；图文背景 `opacity-80→100, brightness-0.5→0.9`，消除用户反馈的偏暗问题
- **视频背景层点击修复** — 背景 `<img>` 原用 `containerEl.insertBefore` 插入可能导致 CSS 选择器不匹配、`pointer-events:none` 失效拦截控件点击；改为插入 `.prism-player` 内部第一个子元素 + 内联强制 `pointer-events:none` + `z-index:0`，控件层提升 `z-index:2`，修复点击控件误触发播放/暂停
- **图文左右切换按钮修复（回归 bug）** — 用户用控制台 `elementFromPoint` 诊断确认：按钮渲染正常但命中测试结果是主图（`z-10`），因按钮无 z-index 被主图盖住导致点击失效（只能触发暂停）。修复加 `z-30`；hover 时背景蒙版加深 40%（`bg-black/50→90`）
- **图文进度条增强** — 每节从 `<div>` 改为 `<button>`，点击跳转到对应图片；悬停加粗 `3px→9px`（固定容器 + items-center 实现中线对称扩展，80ms 过渡）
- **图文控制栏空白点击修复** — 控制栏加 `data-controlbar` 标记，原生 onClick 命中时只切换控制栏可见性，不触发播放/暂停
- **图文音量控制** — 控制栏新增音量按钮（Volume2/Volume1/VolumeX 图标随音量变化），点击静音/取消静音，悬停弹出滑块调节背景音乐音量；滑块用 `linear-gradient` 显示粉色填充进度，注入 CSS（`.bili-vol-slider`）定义 thumb 圆心对齐轨道中线——Tailwind 任意变体 `[&::-webkit-slider-thumb]` 对 range 伪元素不可靠（实测不生效），改用注入 `<style>` 的确定性方案
- **图文中心蒙版动画修复（回归 bug）** — 子代理调研确认：中心指示器 `motion.div` 无 z-index（auto）被主图 `z-10` 盖住，触发逻辑正常但看不到。加 `z-40` 后与视频播放器 `.bili-anim`（z-9999）行为一致

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
1. ~~**实况照片半透明重叠交叉淡化**~~ — 已实现（单 canvas 像素级混合方案，见「已完成工作」实况章节）
2. **Cloudflare R2 替代阿里云 OSS** — OSS 约 2 个月后过期，计划用 Cloudflare R2 完全替代。R2 免费 10GB/月 + 出站流量永久免费。方案：Pre-signed URL 直传（服务器签发临时 URL，浏览器直传 R2），不经过服务器内存。需安装 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`，删除 `ali-oss` 和旧 `/api/upload` 接口。VOD 路径不变。计划文件：`.mimocode/plans/1784085656280-misty-garden.md`
3. **VOD 断点续传** — 上传中断后恢复（aliyun-upload-sdk 支持 checkpoint）
4. **通配符证书** — 当前证书仅覆盖 `your-domain.com` + `www.your-domain.com`，子域名 HTTPS 需更换 `*.your-domain.com` 证书
5. **HSTS** — 启用 `Strict-Transport-Security` 头，强制浏览器 HTTPS
6. **密码哈希存储** — 使用已安装的 bcryptjs 对密码进行哈希存储（MVP 技术债务）
7. **实况照片实测** — 实况照片解析/播放需用真实文件验证（`.livp` / Android Motion Photo / 分离的 HEIC+MOV），当前仅代码层面实现未跑真实文件

### 中期
7. **无限滚动分页** — 首页视频列表无限滚动加载
8. **Toast 消息提示** — 轻量级提示框替代 alert/confirm 弹窗
9. **视频编辑功能** — 支持修改标题/描述
10. **视频详情优化** — 播放量统计、点赞数实时更新

### 长期
11. **监控日志** — 错误监控、用户行为分析

## 技术债务
- 密码明文存储，生产环境需用 bcrypt 哈希（bcryptjs 已安装未启用，已记录为 MVP 特性）
- CSRF 保护不完整，低危路由未启用（已记录为 MVP 特性）
- OSS AccessKey 存在 .env 中，生产环境应使用 RAM 子账号
- 实况照片上传选择普通大图（混合实况时）跳过客户端压缩，超 15MB 可能失败（`processImageFiles` 路径未集成压缩逻辑）

## 已知问题
- 部分图标使用 lucide-react，未完全统一风格
- 投稿页无法复制输入框外的文字（浏览器层面问题，非代码导致）
