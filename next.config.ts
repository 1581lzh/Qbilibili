import type { NextConfig } from "next";
import { networkInterfaces } from "os";

const ips = new Set<string>();
for (const interfaces of Object.values(networkInterfaces())) {
  for (const info of interfaces ?? []) {
    if (!info.internal) ips.add(info.address);
  }
}

const CACHE_60D = "public, max-age=5184000, immutable";

const nextConfig: NextConfig = {
  allowedDevOrigins: [...ips],
  images: {
    // 图片代理缓存 60 天：封面等图片 URL 均带时间戳不可变，上游 R2 未返回缓存头时以此为准
    minimumCacheTTL: 5184000,
    // 图片域名白名单：封面走 /_next/image 优化代理时按此白名单校验，
    // 更换图片域名（.env 的 R2_PUBLIC_URL）必须同步加入白名单，否则封面 400 加载不出来
    remotePatterns: [
      // 占位：R2 公共开发域（迁移前旧图），部署时替换为自己的 pub-xxxxxxxx.r2.dev
      { protocol: "https", hostname: "pub-xxxxxxxx.r2.dev" },
      // 占位：R2 自定义域，部署时替换为实际图片域名（R2_PUBLIC_URL 的主机名）
      { protocol: "https", hostname: "cdn.your-domain.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
    {
      source: "/api/videos/recommendations",
      headers: [{ key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" }],
    },
    {
      source: "/api/videos/:path*/detail",
      headers: [{ key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=120" }],
    },
    {
      source: "/lib/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      // 本地静态资源：文件名均含时间戳/版本号不可变，缓存 60 天
      source: "/uploads/(.*)",
      headers: [{ key: "Cache-Control", value: CACHE_60D }],
    },
    {
      source: "/emoji/(.*)",
      headers: [{ key: "Cache-Control", value: CACHE_60D }],
    },
    {
      source: "/:file.svg",
      headers: [{ key: "Cache-Control", value: CACHE_60D }],
    },
  ],
};

export default nextConfig;
