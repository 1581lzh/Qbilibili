"use client";

import { Images } from "lucide-react";

/**
 * 封面左下角的投稿类型角标：仅图文投稿显示，用于和普通视频区分。
 * 半透明黑底 + 白字，不拦截点击（pointer-events-none）。
 */
export default function PostTypeBadge({ postType, className = "" }: { postType?: string | null; className?: string }) {
  if (postType !== "image_text") return null;
  return (
    <span
      aria-label="图文"
      title="图文"
      className={`pointer-events-none absolute bottom-1 left-1 z-10 inline-flex items-center gap-0.5 rounded bg-black/45 px-1 py-[2px] text-[10px] font-medium leading-none text-white/90 backdrop-blur-[2px] ${className}`}
    >
      <Images className="h-3 w-3" strokeWidth={2} />
      图文
    </span>
  );
}
