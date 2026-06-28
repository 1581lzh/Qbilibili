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
- 用户注册/登录/个人主页
- 点赞、收藏、评论（三层嵌套回复）
- 个人中心点赞详情（视频点赞/我点赞的评论/谁点赞了我的评论）
- 评论跳转（从个人中心点击评论跳转到视频播放页并定位高亮）
- 视频/评论搜索（任意字符匹配，红色高亮）
- 深色/浅色/跟随系统模式切换（平滑过渡动画）
- 全页面移动端适配（响应式布局，sm: 断点 640px）
- 移动端双击暂停/播放视频
- 公共用户主页（查看他人投稿和信息）
- 投稿页移动端提示前往PC端
- Framer Motion 页面/列表/微交互动画（卡片入场、点赞弹跳、评论滑入塌陷、标签左右滑动）
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
    server_name your-domain.com;
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 主站
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/cert.key;
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

在项目根目录创建 `.env` 文件，参考 `.env.example`。

### 必填项

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库文件路径，保持默认即可 | `"file:./dev.db"` |
| `NEXTAUTH_SECRET` | 会话加密密钥，用随机字符串即可。可在终端运行 `openssl rand -base64 32` 生成 | `"abc123..."` |

### 可选项 — 阿里云 OSS（视频/封面存储）

> 不配置则视频上传功能不可用，首页使用内置示例图片。

| 变量 | 说明 | 获取方式 |
|------|------|----------|
| `OSS_REGION` | OSS 存储区域 | 阿里云控制台 → OSS → Bucket 列表 → 地址栏可看到，如 `oss-cn-guangzhou` |
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID | 阿里云控制台 → 头像 → AccessKey 管理 → 创建 AccessKey |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | 创建时只显示一次，务必保存好 |
| `OSS_BUCKET` | OSS Bucket 名称 | 阿里云控制台 → OSS → 创建 Bucket → 填写的 Bucket 名 |

### 可选项 — 阿里云 VOD（视频点播）

> 不配置则视频走 OSS 直链存储。配置后支持鉴权播放、转码、播放统计等功能。

| 变量 | 说明 | 获取方式 |
|------|------|----------|
| `VOD_REGION` | VOD 服务区域 | 阿里云控制台 → 视频点播 → 基础设置 → 服务区域，如 `cn-shenzhen` |
| `VOD_ACCESS_KEY_ID` | 阿里云 AccessKey ID | 同 OSS，可共用同一个 AccessKey |
| `VOD_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | 同 OSS |
| `VOD_SPACE_NAME` | VOD 媒体空间名称 | 阿里云控制台 → 视频点播 → 配置管理 → 媒体空间 → 复制空间 ID |

### 完整 .env 示例

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here"

# 阿里云 OSS
OSS_REGION=oss-cn-guangzhou
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=your-bucket-name

# 阿里云 VOD
VOD_REGION=cn-shenzhen
VOD_ACCESS_KEY_ID=your-access-key-id
VOD_ACCESS_KEY_SECRET=your-access-key-secret
VOD_SPACE_NAME=your-space-name
```

### 阿里云账号开通步骤

1. 注册/登录 [阿里云控制台](https://www.aliyun.com/)
2. 开通 **对象存储 OSS** 服务（按量付费，有免费额度）
3. 创建一个 Bucket（权限设为「私有」）
4. 开通 **视频点播 VOD** 服务（如需使用）
5. 创建一个媒体空间
6. 进入 [AccessKey 管理页面](https://usercentre.console.aliyun.com/)，创建 AccessKey
7. 将获取到的值填入 `.env` 文件

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
