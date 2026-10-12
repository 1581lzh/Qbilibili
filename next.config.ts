import type { NextConfig } from "next";
import { networkInterfaces } from "os";

const ips = new Set<string>();
for (const interfaces of Object.values(networkInterfaces())) {
  for (const info of interfaces ?? []) {
    if (!info.internal) ips.add(info.address);
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [...ips],
  images: {
    // 图片域名白名单：封面走 /_next/image 优化代理时按此白名单校验，
    // 更换图片域名（.env 的 R2_PUBLIC_URL）必须同步加入白名单，否则封面 400 加载不出来
    remotePatterns: [
      { protocol: "https", hostname: "pub-eac7cb1048244abfbb60dfa583083e0e.r2.dev" },
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
  ],
};

export default nextConfig;
