# Bilibili 风格视频平台 MVP

仿 Bilibili 的视频平台最小可行产品，支持视频上传/播放、用户系统、评论互动、搜索、深色模式等功能。

## 功能特性

- 首页视频卡片网格布局
- 视频播放（Aliplayer 统一播放，循环/单次/自动连播三种模式）
- 视频切换（上一个/下一个，PlaylistComponent 原生按钮）
- 点击视频封面自动非静音播放
- 播放/暂停中心弹性动画
- 上传视频到阿里云 VOD（自动回退 OSS）
- 阿里云 VOD 视频点播对接（服务端鉴权 + 客户端 SDK 上传 + 鉴权播放）
- 图文投稿左右布局（大预览+瀑布流缩略图+编辑模式+设置封面+多音频支持+图片预览时长设置，客户端压缩）
- 图文播放（图片轮播+音频自动播放+空格键暂停+滑动切换+自动轮播+底部图片进度条+弹性动画指示器+PC单击暂停+移动端双击暂停）
- 用户注册/登录/个人主页
- 点赞、收藏、评论（三层嵌套回复、图片附件、回复引用预览）
- 评论图片附件（每条最多7张，文字可选，单图4:3/多图1:1网格，全屏灯箱查看，支持粘贴上传，自动压缩）
- 灯箱缩放（鼠标滚轮/按钮/键盘缩放，双击切换，拖拽平移，移动端双指捏合）
- 个人中心点赞详情（视频点赞/我点赞的评论/谁点赞了我的评论）
- 评论跳转（从个人中心点击评论跳转到视频播放页并定位高亮）
- 视频/评论搜索（任意字符匹配，红色高亮）
- 深色/浅色/跟随系统模式切换（平滑过渡动画）
- 全页面移动端适配（响应式布局，sm: 断点 640px）
- 移动端双击暂停/播放视频
- 公共用户主页（查看他人投稿和信息）
- 投稿页移动端提示前往PC端
- Framer Motion 页面/列表/微交互动画（卡片入场、点赞弹跳、评论滑入塌陷、标签左右滑动）
- 毛玻璃效果（下拉菜单 backdrop-blur-xl 模糊页面内容、弹窗遮罩层模糊 + 半透明背景）
- 登录/注册弹窗（首页悬浮弹窗，登录/注册 Tab 切换，注册成功自动填充用户名）
- 用户注销功能（密码确认，自定义确认弹窗，递归删除所有数据）
- 收藏按钮显示收藏数量
- 播放器控制栏优化（lucide-react 图标，上一个→播放→下一个布局）
- 管理面板（仅 LZH 用户可访问，用户/视频/评论/点赞/收藏管理，封面预览图，搜索过滤）
- 安全防护（SQL注入/XSS/CSRF防护、速率限制、输入验证、文件上传安全、安全响应头）
- 会话安全（JWT 7天有效期、密码修改后旧会话自动失效、已删除用户token撤销）
- 数据一致性保障（关键删除操作使用事务，级联删除完整）
- 封面图片懒加载 + OSS图片处理（按需缩放+WebP格式转换+质量压缩）
- 弱网图片加载优化（预连接、尺寸属性、异步解码、本地占位图、picsum缩放）
- OSS URL 自动升级 HTTPS（消除 Mixed Content 警告）
- 弱网交互优化（乐观更新即时响应、页面骨架屏、代码分割、播放器预加载、API缓存头、客户端fetch缓存）
- 音频响度标准化（FFmpeg loudnorm 两次通过，-14 LUFS 流媒体标准，精度 ±0.5 LU，上传后自动统一音量，支持视频和图文所有类型，播放器优先使用标准化音频，非阻塞播放，管理面板可一键重新标准化+实时进度追踪）
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

## 生产部署指南

本项目为开源示例版本，部分敏感信息已替换为占位符。部署前请按以下清单逐项修改：

### 1. 环境变量（必须修改）

编辑项目根目录 `.env` 文件，将以下占位符替换为你的真实值：

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| `NEXTAUTH_SECRET` | JWT 签名密钥 | 随机生成：`openssl rand -base64 32` |
| `NEXTAUTH_URL` | 站点域名 | 改为你的域名，如 `https://your-domain.com` |
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID | 阿里云控制台 → AccessKey 管理 |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | 同上（仅显示一次，妥善保存） |
| `OSS_BUCKET` | OSS 存储桶名称 | 阿里云控制台 → OSS → Bucket 列表 |
| `VOD_ACCESS_KEY_ID` | VOD AccessKey ID | 阿里云控制台 → 视频点播 → 基础设置 |
| `VOD_ACCESS_KEY_SECRET` | VOD AccessKey Secret | 同上 |
| `VOD_SPACE_NAME` | VOD 视频空间名称 | 阿里云控制台 → 视频点播 → 媒资管理 → 视频空间 |

### 2. 域名配置（必须修改）

文件：`src/lib/audio-queue.ts` 第 123 行

```typescript
// 修改前（占位符）
videoUrl = `https://your-domain.com${videoUrl}`;

// 修改后（替换为你的域名）
videoUrl = `https://your-domain.com${videoUrl}`;
```

将 `your-domain.com` 替换为你的实际域名。

### 3. Nginx 配置（部署时修改）

参考 README 中的 Nginx 配置模板，需要修改以下内容：

| 配置项 | 位置 | 说明 |
|--------|------|------|
| `server_name` | server 块 | 改为你的域名，如 `example.com *.example.com` |
| `ssl_certificate` | HTTPS server 块 | 改为你的 SSL 证书路径 |
| `ssl_certificate_key` | HTTPS server 块 | 改为你的 SSL 私钥路径 |

### 4. 管理员账号（可选修改）

当前管理面板仅允许用户名为 `LZH` 的用户访问。如需修改：

文件：`src/app/(main)/admin/page.tsx`

搜索 `LZH`，替换为你想要的管理员用户名。

### 5. NEXTAUTH_URL 配置

本地开发时保持 `http://localhost:3005`，部署到生产环境后改为你的域名：

```env
NEXTAUTH_URL=https://your-domain.com
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
