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
