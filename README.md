# Bilibili 风格视频平台 MVP

仿 Bilibili 的视频平台最小可行产品，支持视频上传/播放、用户系统、评论互动、搜索、深色模式等功能。

## 功能特性

- 首页视频卡片网格布局
- 视频播放（Aliplayer 统一播放，循环/单次/自动连播三种模式，按用户永久保存到数据库）
- 视频切换（上一个/下一个，PlaylistComponent 原生按钮）
- 键盘快捷键（方向键快退/快进 5 秒，A/D 键同效；评论/搜索输入时自动解除控制，中文输入法组合键不误触；空格播放/暂停）
- 点击视频封面自动非静音播放
- 播放/暂停中心弹性动画
- 上传视频到阿里云 VOD（自动回退 OSS）
- 阿里云 VOD 视频点播对接（服务端鉴权 + 客户端 SDK 上传 + 鉴权播放；上传进度按 loaded/total 真实计算，视频/图文投稿统一直接调用 handleSubmit 提交）
- 图文投稿左右布局（大预览+瀑布流缩略图+编辑模式+设置封面+多音频支持+图片预览时长设置，客户端压缩）
- 图文播放（图片轮播+多首音频拼接+音频自动播放+空格键暂停+相册式左右平移切换（鼠标左键按住拖动/触摸滑动/方向键与A/D键/左右按钮/进度条跳转，头尾循环）+自动轮播+播放模式切换（循环/单次/自动连播，与视频共享）+底部图片进度条（始终显示，点击跳转+悬停加粗，控制栏升起时被托起、落下时回到底部）+音量控制（静音+滑块，音量条/模式提示弹层不被控制栏裁切）+弹性动画指示器+PC单击暂停+移动端双击暂停+预加载窗口（当前图前后各 2 张图片及其实况视频数据提前加载））
- 图文图片预览时长支持自动模式（根据音频总时长和图片数量自动计算每张图片停留时长）和手动模式（1-30秒）
- 实况照片（Live Photo）支持（Android Motion Photo 单文件解析 / Apple .livp 解包 / HEIC 分离格式同名/相似名配对；播放时自动静音播放实况视频，进度条显示视频进度，视频完整播完再切下一张；静态图时长 = (总音频-实况总时长)/静态图数 拉平节奏；实况只能用静态帧做封面）
- 实况照片播放过渡（预览 1s 封面帧 → 封面/实况 0.8s 半透明重叠交叉淡化 → 播放 → 实况/封面交叉淡化 → 预览 1s → 循环；单 canvas 像素级混合方案，已实现两画面同时半透明重叠；封面→实况无闪烁；暂停保留进度原地暂停实况）
- 图文投稿实况视频（可上传 ≤4 秒短视频作为实况，超时提示前往视频投稿；大预览/缩略图播放预览，播完自动暂停）
- 高斯模糊背景填充黑边（视频用封面图、图文用当前图做模糊背景，比较媒体实际比例与容器比例自适应移动端/PC端，图文每页模糊背景随图片一起平移、互不串色）
- 视频编辑功能（独立编辑页面，支持修改标题/描述/封面，图文类型支持修改图片顺序/轮播时长（自动/手动）/从现有图片选择封面/上传新封面，视频播放页和个人中心均可编辑）
- 用户注册/登录/个人主页
- 点赞、收藏、评论（三层嵌套回复、图片附件、回复引用预览）
- 评论图片附件（每条最多7张，文字可选；单图等比缩小显示，多图 1:1 正方形 3 列缩略图网格（max-w-[450px]，移动端等宽自适应），GIF 动图完整显示；全屏灯箱查看，支持文件选择/粘贴上传/粘贴图片URL自动下载，自动压缩，GIF 超限提示不压缩保动画）
- 评论图片灯箱（相册式三页轨道滑动切换：移动端单指滑动/桌面端鼠标拖拽实时跟手，松手超 1/4 页宽滑入相邻页否则回弹，头尾循环；缩放 0.5-5 倍：鼠标滚轮/按钮/键盘缩放 + 移动端双指增量捏合，双击切换缩放（原生状态机判定），拖拽平移，缩放下限 0.5 倍；移动端系统返回键直接关闭灯箱）
- 个人中心点赞详情（视频点赞/我点赞的评论/谁点赞了我的评论）
- 评论跳转（从个人中心点击评论跳转到视频播放页并定位高亮）
- 视频/评论搜索（任意字符匹配，红色高亮）
- 深色/浅色/跟随系统模式切换（圆形遮罩扩散动画：只遮最下方背景层不遮挡UI，支持连续切换的"圆中圆"效果，背景扩散完成后文字/UI颜色单独渐变，以最后一次切换为准；登录用户按用户存数据库，跨设备/刷新恢复，未登录 fallback localStorage）
- 全页面移动端适配（响应式布局，sm: 断点 640px）
- 移动端双击暂停/播放视频
- 公共用户主页（查看他人投稿和信息）
- 投稿页移动端提示前往PC端
- Framer Motion 页面/列表/微交互动画（卡片入场、点赞弹跳、评论滑入塌陷、标签左右滑动）
- 毛玻璃效果（下拉菜单 backdrop-blur-xl 模糊页面内容、弹窗遮罩层模糊 + 半透明背景）
- 登录/注册弹窗（首页悬浮弹窗，登录/注册 Tab 切换，注册成功自动填充用户名）
- 用户注销功能（密码确认，自定义确认弹窗，递归删除所有数据）
- Emoji 支持（评论/投稿支持 Unicode emoji 和抖音表情包，选择器面板分类浏览+搜索，contentEditable 实时预览，B站格式 `:表情名:` 兼容）
- 收藏按钮显示收藏数量
- 播放器控制栏优化（lucide-react 图标，上一个→播放→下一个布局）
- 评论区输入框增高（2.5 行高，可看到下一行文字，自动延展）
- 头像颜色统一（所有位置按用户名哈希生成同色头像，个人中心/头像菜单/视频作者/评论/推荐/管理面板一致）
- 相关推荐作者头像（作者名前 20px 圆形头像，顶部对齐）
- 管理面板（仅 LZH 用户可访问，用户/视频/评论/点赞/收藏管理，封面预览图，搜索过滤）
- 安全防护（SQL注入/XSS/CSRF防护、速率限制、输入验证、文件上传安全、安全响应头）
- 评论粘贴净化（从其他网页复制的文字粘贴进评论区只保留纯文本，丢弃源页面内联样式与 HTML 标签，图片/GIF/图片URL 粘贴不受影响）
- 会话安全（JWT 7天有效期、密码修改后旧会话自动失效、已删除用户token撤销）
- 数据一致性保障（关键删除操作使用事务，级联删除完整）
- 封面图片懒加载 + OSS图片处理（按需缩放+WebP格式转换+质量压缩）
- 弱网图片加载优化（预连接、尺寸属性、异步解码、本地占位图、picsum缩放）
- OSS URL 自动升级 HTTPS（消除 Mixed Content 警告）
- 弱网交互优化（乐观更新即时响应、页面骨架屏、代码分割、播放器预加载、API缓存头、客户端fetch缓存）
- 音频响度标准化（FFmpeg loudnorm 两次通过，-14 LUFS 流媒体标准，精度 ±0.5 LU，上传后自动统一音量，支持视频和图文所有类型，播放器优先使用标准化音频，非阻塞播放，管理面板可一键重新标准化+实时进度追踪）
- 输入框滚动条适配深色模式（评论区/标题/简介/搜索框）
- 输入长度限制（用户名最多14字符、密码最多18字符、描述/简介最多1000字符）
- 音量状态持久化（图文播放器和视频播放器音量/静音状态共享，按用户存数据库，未登录 fallback 本地存储；图文音量条悬停弹出 1.5s 自动消失）
- 性能优化（搜索 DB 层过滤、评论删除 BFS、音频队列 2 并发、FFmpeg 流式处理、上传流式、VOD 缓存 LRU、数据库索引）

## 技术栈

| 技术 | 说明 |
|------|------|
| Next.js 16 | React 框架 (App Router) |
| TypeScript | 类型安全 |
| Tailwind CSS v4 | UI 样式 |
| Prisma + SQLite | 数据库 |
| NextAuth.js v5 | 用户认证 |
| Framer Motion | 页面/列表/微交互动画 |
| zod | 输入验证 |
| 阿里云 OSS | 视频/封面存储 |
| 阿里云 VOD | 视频点播（鉴权上传 + 鉴权播放） |
| Aliplayer 2.25.1 | 统一视频播放器 |
| motion-photo | Android Motion Photo 单文件解析（XMP 提取内嵌视频） |
| heic-normalize | HEIC/HEIF 转 JPEG（Safari 原生解码 + WASM 兜底） |
| jszip | .livp 实况照片压缩包解包 |

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装与启动

```bash
# 克隆项目
git clone <仓库地址>
cd bilibili

# 安装依赖
npm install

# 生成 Prisma 客户端
npx prisma generate

# 启动开发服务器（监听所有网络接口，支持局域网访问）
npm run dev
```

> 默认监听所有 IP（`0.0.0.0:3005`），局域网设备可通过 `http://<服务器IP>:3005` 访问。

## 跨平台构建

> Prisma 会生成平台专用二进制文件，**不能**直接复制 Windows 的构建产物到 Linux 使用。需要在目标平台上重新构建。

### Windows

```bash
npm install
npx prisma generate
npm run build
npm run start
```

### Linux / CentOS

```bash
# 1. 上传源码（不含 .next、node_modules、src/generated）
scp -r . user@server:/opt/bilibili

# 2. 在服务器上安装依赖并构建
cd /opt/bilibili
npm install
npx prisma generate
npm run build

# 3. 启动服务
npm run start
```

### Docker（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3005
CMD ["npm", "start"]
```

## Nginx 配置（HTTPS）

生产环境使用 Nginx 反向代理 + SSL 终止：

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;

# HTTP → HTTPS 跳转
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com *.your-domain.com;
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 主站
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name your-domain.com *.your-domain.com;

    ssl_certificate     /etc/nginx/ssl/your-domain.com.pem;
    ssl_certificate_key /etc/nginx/ssl/your-domain.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        limit_req zone=api burst=100 nodelay;
    }
}
```

> **限流说明**：Next.js 页面刷新会并发发出大量 RSC 请求，rate=50r/s burst=100 可避免 503。
>
> **证书**：当前使用 DigiCert 证书覆盖 `your-domain.com` + `www.your-domain.com`，存放在 `/etc/nginx/ssl/`。
> 如需子域名 HTTPS 需更换通配符证书。

## systemd 服务部署（CentOS/Linux）

项目提供 `deploy.sh` 脚本，可将应用注册为 systemd 服务，支持开机自启和后台运行。

```bash
# 安装为 systemd 服务（需要 root 权限）
sudo ./deploy.sh install

# 服务管理
sudo ./deploy.sh start      # 启动
sudo ./deploy.sh stop       # 停止
sudo ./deploy.sh restart    # 重启
sudo ./deploy.sh status     # 查看状态
sudo ./deploy.sh uninstall  # 卸载服务

# 查看实时日志
sudo journalctl -u bilibili -f
```

安装后服务信息：
- 服务名称：`bilibili`
- 监听端口：`3005`
- 开机自启：已启用

## 项目文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 项目指南、开发规则、注意事项 |
| [PROGRESS.md](./PROGRESS.md) | 项目进度、已完成工作、短中长期目标 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 技术架构、目录结构、数据模型、API 路由 |
| [CROSSFADE-ISSUE.md](./CROSSFADE-ISSUE.md) | 实况照片半透明重叠交叉淡化问题记录（已解决，含根因分析、踩坑记录与最终方案） |

## 环境变量

在项目根目录创建 `.env` 文件：

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="your-secret-key-here"

# 阿里云 OSS（可选，不配置则使用示例图片）
OSS_REGION=oss-cn-guangzhou
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=your-bucket-name

# 阿里云 VOD（可选，不配置则视频走 OSS 存储）
VOD_REGION=cn-shenzhen
VOD_ACCESS_KEY_ID=your-access-key-id
VOD_ACCESS_KEY_SECRET=your-access-key-secret
VOD_SPACE_NAME=your-space-name
```

## 常见问题

### Windows 上删除含方括号的目录失败

PowerShell 会将 `[id]` 解释为通配符，使用 cmd 转义：

```powershell
cmd /c "rmdir /s /q path\^ [id]"
```

### Linux 上启动报 Prisma 错误

确保重新执行了 `npx prisma generate`，不要直接复制 Windows 的 `src/generated` 目录。

### Linux 构建时 TypeScript 类型错误

Prisma 查询结果在 Linux 环境下可能无法自动推断类型，导致隐式 `any` 错误。解决方案：为服务端组件中的 Prisma 查询结果添加显式类型标注（如 `const videos: VideoWithAuthor[] = await db.video.findMany(...)`）。

### NEXTAUTH_SECRET 更换

如果遇到登录失效，检查 `.env` 中的 `NEXTAUTH_SECRET` 是否为随机强密钥。更换密钥后所有已登录用户需重新登录。

### 搜索栏输入无响应

确保开发服务器正在运行，检查端口 3005 是否被占用。

## MVP 安全说明

本项目为 MVP（最小可行产品），以下安全措施是有意简化的：

- **密码明文存储**：当前密码以明文存储和比较。`bcryptjs` 已安装但未启用。生产环境必须使用哈希存储
- **CSRF 覆盖不完整**：低危路由（点赞、收藏、评论）未启用 CSRF 校验。生产环境应为所有写操作端点添加 CSRF 保护
